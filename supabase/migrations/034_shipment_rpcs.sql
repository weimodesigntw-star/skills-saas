-- 自動產生出貨單號
CREATE OR REPLACE FUNCTION generate_ship_code(p_user_id UUID, p_prefix TEXT DEFAULT 'BA202')
RETURNS TEXT AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM shipments
  WHERE user_id = p_user_id
  AND ship_code LIKE p_prefix || '-' || v_today || '-%';
  RETURN p_prefix || '-' || v_today || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 從訂單轉出貨（原子操作：建出貨單 + 扣庫存 + 更新訂單 shipped_qty）
CREATE OR REPLACE FUNCTION create_shipment_from_order(
  p_user_id         UUID,
  p_order_id        UUID,
  p_ship_date       DATE,
  p_depot_id        UUID,
  p_items           JSONB,
  p_note            TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_ship_code TEXT;
  v_shipment_id UUID;
  v_item JSONB;
  v_order RECORD;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_order FROM customer_orders WHERE id = p_order_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;

  v_ship_code := generate_ship_code(p_user_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (v_item->>'qty')::NUMERIC * (v_item->>'unit_price')::NUMERIC;
  END LOOP;
  v_tax := ROUND(v_subtotal * v_order.taxrate / (1 + v_order.taxrate), 2);
  v_total := v_subtotal;

  INSERT INTO shipments (
    user_id, ship_code, ship_date, member_id,
    source_order_code, source_order_id, depot_id,
    currency, tax_type, taxrate,
    subtotal, tax_amount, total, amt_outstanding,
    note, status
  ) VALUES (
    p_user_id, v_ship_code, p_ship_date, v_order.member_id,
    v_order.order_code, p_order_id, p_depot_id,
    v_order.currency, v_order.tax_type, v_order.taxrate,
    v_subtotal, v_tax, v_total, v_total,
    p_note, 'valid'
  ) RETURNING id INTO v_shipment_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO shipment_items (
      shipment_id, order_item_id, product_id,
      product_code, product_name, unit_name, qty, unit_price, subtotal
    )
    SELECT
      v_shipment_id,
      (v_item->>'order_item_id')::UUID,
      (v_item->>'product_id')::UUID,
      coi.product_code, coi.product_name, coi.unit_name,
      (v_item->>'qty')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      (v_item->>'qty')::NUMERIC * (v_item->>'unit_price')::NUMERIC
    FROM customer_order_items coi
    WHERE coi.id = (v_item->>'order_item_id')::UUID;

    UPDATE products
    SET stock = GREATEST(stock - (v_item->>'qty')::NUMERIC, 0)
    WHERE id = (v_item->>'product_id')::UUID;

    UPDATE customer_order_items
    SET shipped_qty = shipped_qty + (v_item->>'qty')::NUMERIC
    WHERE id = (v_item->>'order_item_id')::UUID;
  END LOOP;

  UPDATE customer_orders SET status = 'shipped' WHERE id = p_order_id;

  RETURN jsonb_build_object('shipment_id', v_shipment_id, 'ship_code', v_ship_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
