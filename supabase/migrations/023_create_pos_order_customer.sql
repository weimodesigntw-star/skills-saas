-- P2-2 修補：結帳時寫入顧客姓名、電話，並支援 RPC 回傳訂單編號
-- 擴充 create_pos_order 參數，INSERT 時寫入 customer_name, customer_phone

CREATE OR REPLACE FUNCTION create_pos_order(
  p_user_id UUID,
  p_payment_method TEXT,
  p_items JSONB,
  p_discount_amount DECIMAL DEFAULT 0,
  p_note TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal DECIMAL := 0;
  v_tax_amount DECIMAL := 0;
  v_total DECIMAL := 0;
  v_item JSONB;
  v_stock INTEGER;
  v_product_name TEXT;
  v_product_barcode TEXT;
  v_item_subtotal DECIMAL;
  v_today_count INTEGER;
BEGIN
  SELECT COALESCE(COUNT(*), 0) INTO v_today_count
  FROM orders
  WHERE user_id = p_user_id
  AND created_at::date = CURRENT_DATE;

  v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD((v_today_count + 1)::TEXT, 4, '0');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT stock, name, barcode
    INTO v_stock, v_product_name, v_product_barcode
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '商品不存在 (ID: %)', v_item->>'product_id';
    END IF;

    IF v_stock < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION '商品「%」庫存不足（剩餘 %，需要 %）',
        v_product_name, v_stock, (v_item->>'quantity')::INTEGER;
    END IF;

    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  v_tax_amount := ROUND(v_subtotal * 5 / 105, 0);
  v_total := v_subtotal - p_discount_amount;

  INSERT INTO orders (
    id, user_id, order_number, status, payment_method,
    subtotal, tax_amount, discount_amount, total_amount, note,
    customer_name, customer_phone
  )
  VALUES (
    gen_random_uuid(), p_user_id, v_order_number, 'paid', p_payment_method,
    v_subtotal, v_tax_amount, p_discount_amount, v_total, p_note,
    p_customer_name, p_customer_phone
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT name, barcode INTO v_product_name, v_product_barcode
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;

    INSERT INTO order_items (
      order_id, product_id, product_name, product_barcode,
      quantity, unit_price, subtotal
    )
    VALUES (
      v_order_id, (v_item->>'product_id')::UUID, v_product_name, v_product_barcode,
      (v_item->>'quantity')::INTEGER, (v_item->>'unit_price')::DECIMAL, v_item_subtotal
    );

    UPDATE products
    SET stock = stock - (v_item->>'quantity')::INTEGER,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_pos_order(UUID, TEXT, JSONB, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;
