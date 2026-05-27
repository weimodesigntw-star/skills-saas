-- Migration 056: Product stock by depot
-- Adds per-warehouse stock balances while keeping products.physical_stock/stock
-- as the aggregate total for legacy screens and integrations.

CREATE TABLE IF NOT EXISTS public.product_depot_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  depot_id uuid NOT NULL REFERENCES public.depots(id) ON DELETE CASCADE,
  qty integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, product_id, depot_id)
);

CREATE INDEX IF NOT EXISTS idx_product_depot_stocks_user_id
  ON public.product_depot_stocks(user_id);
CREATE INDEX IF NOT EXISTS idx_product_depot_stocks_product_id
  ON public.product_depot_stocks(product_id);
CREATE INDEX IF NOT EXISTS idx_product_depot_stocks_depot_id
  ON public.product_depot_stocks(depot_id);

ALTER TABLE public.product_depot_stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner access" ON public.product_depot_stocks;
CREATE POLICY "owner access" ON public.product_depot_stocks
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS product_depot_stocks_updated_at ON public.product_depot_stocks;
CREATE TRIGGER product_depot_stocks_updated_at
  BEFORE UPDATE ON public.product_depot_stocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.stock_adjustments
  ADD COLUMN IF NOT EXISTS depot_id uuid REFERENCES public.depots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_depot_id
  ON public.stock_adjustments(depot_id);

ALTER TABLE public.stock_adjustments
  DROP CONSTRAINT IF EXISTS stock_adjustments_type_check;

ALTER TABLE public.stock_adjustments
  ADD CONSTRAINT stock_adjustments_type_check
  CHECK (type IN (
    'restock',
    'loss',
    'manual',
    'reserve',
    'release',
    'ship',
    'sync_channel'
  ));

-- Ensure every owner has a default depot, then seed current product totals into
-- product_depot_stocks. Existing product depot_id is preferred when available.
INSERT INTO public.depots (user_id, depot_code, depot_name, note)
SELECT DISTINCT p.user_id, 'DEFAULT', '預設倉庫', '系統建立：承接既有商品庫存'
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.depots d
  WHERE d.user_id = p.user_id
    AND d.depot_code = 'DEFAULT'
);

INSERT INTO public.product_depot_stocks (user_id, product_id, depot_id, qty)
SELECT
  p.user_id,
  p.id,
  COALESCE(
    p.depot_id,
    (
      SELECT d.id
      FROM public.depots d
      WHERE d.user_id = p.user_id
      ORDER BY (d.depot_code = 'DEFAULT') DESC, d.created_at ASC
      LIMIT 1
    )
  ) AS depot_id,
  GREATEST(COALESCE(p.physical_stock, p.stock, 0), 0) AS qty
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_depot_stocks s
  WHERE s.user_id = p.user_id
    AND s.product_id = p.id
);

CREATE OR REPLACE FUNCTION public.sync_product_physical_stock_from_depots(
  p_product_id uuid,
  p_user_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COALESCE(SUM(qty), 0)
  INTO v_total
  FROM public.product_depot_stocks
  WHERE product_id = p_product_id
    AND user_id = p_user_id;

  UPDATE public.products
  SET physical_stock = v_total,
      stock = v_total,
      updated_at = now()
  WHERE id = p_product_id
    AND user_id = p_user_id;

  RETURN v_total;
END;
$$;

DROP FUNCTION IF EXISTS public.adjust_inventory(uuid, uuid, text, integer, text);

CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_user_id uuid,
  p_type text,
  p_qty integer,
  p_note text DEFAULT NULL,
  p_depot_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_physical integer;
  v_reserved integer;
  v_channel integer;
  v_depot_id uuid;
  v_depot_current integer;
  v_depot_after integer;
  v_change integer;
  v_after_physical integer;
BEGIN
  IF p_type NOT IN ('restock', 'loss', 'manual', 'reserve', 'release', 'ship', 'sync_channel') THEN
    RAISE EXCEPTION 'invalid type: %', p_type;
  END IF;

  SELECT physical_stock, reserved_stock, channel_stock_easystore
  INTO v_physical, v_reserved, v_channel
  FROM public.products
  WHERE id = p_product_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned';
  END IF;

  IF p_type IN ('restock', 'loss', 'manual', 'ship') THEN
    IF p_depot_id IS NULL THEN
      SELECT COALESCE(
        (SELECT depot_id FROM public.products WHERE id = p_product_id AND user_id = p_user_id),
        (SELECT id FROM public.depots WHERE user_id = p_user_id ORDER BY (depot_code = 'DEFAULT') DESC, created_at ASC LIMIT 1)
      )
      INTO v_depot_id;
    ELSE
      v_depot_id := p_depot_id;
    END IF;

    IF v_depot_id IS NULL THEN
      RAISE EXCEPTION 'depot is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.depots WHERE id = v_depot_id AND user_id = p_user_id) THEN
      RAISE EXCEPTION 'depot not found or not owned';
    END IF;

    INSERT INTO public.product_depot_stocks (user_id, product_id, depot_id, qty)
    VALUES (p_user_id, p_product_id, v_depot_id, 0)
    ON CONFLICT (user_id, product_id, depot_id) DO NOTHING;

    SELECT qty
    INTO v_depot_current
    FROM public.product_depot_stocks
    WHERE user_id = p_user_id
      AND product_id = p_product_id
      AND depot_id = v_depot_id
    FOR UPDATE;

    CASE p_type
      WHEN 'restock' THEN
        IF p_qty < 0 THEN RAISE EXCEPTION 'restock qty must be >= 0'; END IF;
        v_depot_after := v_depot_current + p_qty;
      WHEN 'loss' THEN
        IF p_qty < 0 THEN RAISE EXCEPTION 'loss qty must be >= 0'; END IF;
        v_depot_after := GREATEST(v_depot_current - p_qty, 0);
      WHEN 'manual' THEN
        IF p_qty < 0 THEN RAISE EXCEPTION 'manual qty must be >= 0'; END IF;
        v_depot_after := p_qty;
      WHEN 'ship' THEN
        IF p_qty < 0 THEN RAISE EXCEPTION 'ship qty must be >= 0'; END IF;
        v_depot_after := GREATEST(v_depot_current - p_qty, 0);
    END CASE;

    v_change := v_depot_after - v_depot_current;

    UPDATE public.product_depot_stocks
    SET qty = v_depot_after,
        updated_at = now()
    WHERE user_id = p_user_id
      AND product_id = p_product_id
      AND depot_id = v_depot_id;

    v_after_physical := public.sync_product_physical_stock_from_depots(p_product_id, p_user_id);

    IF p_type = 'ship' THEN
      UPDATE public.products
      SET reserved_stock = GREATEST(reserved_stock - p_qty, 0),
          updated_at = now()
      WHERE id = p_product_id
        AND user_id = p_user_id
      RETURNING reserved_stock INTO v_reserved;
    END IF;

    INSERT INTO public.stock_adjustments
      (user_id, product_id, depot_id, type, qty_change, qty_after, note)
    VALUES
      (p_user_id, p_product_id, v_depot_id, p_type, v_change, v_depot_after, p_note);

    RETURN jsonb_build_object(
      'physical_stock', v_after_physical,
      'reserved_stock', v_reserved,
      'available_stock', GREATEST(v_after_physical - v_reserved, 0),
      'channel_stock_easystore', v_channel,
      'depot_id', v_depot_id,
      'depot_stock', v_depot_after
    );
  END IF;

  IF p_type = 'reserve' THEN
    IF p_qty < 0 THEN RAISE EXCEPTION 'reserve qty must be >= 0'; END IF;
    IF (v_physical - (v_reserved + p_qty)) < 0 THEN
      RAISE EXCEPTION 'insufficient available stock';
    END IF;
    v_reserved := v_reserved + p_qty;
  ELSIF p_type = 'release' THEN
    IF p_qty < 0 THEN RAISE EXCEPTION 'release qty must be >= 0'; END IF;
    v_reserved := GREATEST(v_reserved - p_qty, 0);
  ELSIF p_type = 'sync_channel' THEN
    IF p_qty < 0 THEN RAISE EXCEPTION 'sync_channel qty must be >= 0'; END IF;
    v_channel := p_qty;
  END IF;

  UPDATE public.products
  SET reserved_stock = v_reserved,
      channel_stock_easystore = v_channel,
      updated_at = now()
  WHERE id = p_product_id
    AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'physical_stock', v_physical,
    'reserved_stock', v_reserved,
    'available_stock', GREATEST(v_physical - v_reserved, 0),
    'channel_stock_easystore', v_channel
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_product_physical_stock_from_depots(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, uuid, text, integer, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_purchase_order(
  p_user_id uuid,
  p_vendor_id uuid,
  p_vendor_name text,
  p_receive_day date,
  p_depot_id uuid,
  p_tax_type text,
  p_taxrate numeric,
  p_items jsonb,
  p_note text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_code text;
  v_purchase_id uuid;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_item_sub numeric;
  v_product_id uuid;
BEGIN
  v_code := generate_purchase_code(p_user_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_sub := (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric;
    v_subtotal := v_subtotal + v_item_sub;
  END LOOP;

  IF p_tax_type = '稅內含' THEN
    v_tax := ROUND(v_subtotal * p_taxrate / (1 + p_taxrate), 2);
    v_total := v_subtotal;
  ELSIF p_tax_type = '稅外加' THEN
    v_tax := ROUND(v_subtotal * p_taxrate, 2);
    v_total := v_subtotal + v_tax;
  ELSE
    v_total := v_subtotal;
  END IF;

  INSERT INTO public.purchase_orders (
    user_id, receive_code, receive_day, vendor_id, vendor_name,
    depot_id, currency, tax_type, taxrate,
    subtotal, tax_amount, total, amt_unpaid, note, status
  ) VALUES (
    p_user_id, v_code, p_receive_day, p_vendor_id, p_vendor_name,
    p_depot_id, '台幣', p_tax_type, p_taxrate,
    v_subtotal, v_tax, v_total, v_total, p_note, 'valid'
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_sub := (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric;
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;

    INSERT INTO public.purchase_order_items (
      purchase_id, product_id, product_code,
      product_name, unit_name, qty, unit_price, subtotal
    ) VALUES (
      v_purchase_id,
      v_product_id,
      v_item->>'product_code',
      v_item->>'product_name',
      v_item->>'unit_name',
      (v_item->>'qty')::numeric,
      (v_item->>'unit_price')::numeric,
      v_item_sub
    );

    IF v_product_id IS NOT NULL THEN
      PERFORM public.adjust_inventory(
        v_product_id,
        p_user_id,
        'restock',
        (v_item->>'qty')::integer,
        format('採購進貨（%s）', v_code),
        p_depot_id
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'receive_code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_shipment_from_order(
  p_user_id uuid,
  p_order_id uuid,
  p_ship_date date,
  p_depot_id uuid,
  p_items jsonb,
  p_note text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
  v_ship_code text;
  v_shipment_id uuid;
  v_item jsonb;
  v_order record;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_product_id uuid;
BEGIN
  SELECT * INTO v_order FROM public.customer_orders WHERE id = p_order_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'order not found'; END IF;

  v_ship_code := generate_ship_code(p_user_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_subtotal := v_subtotal + (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric;
  END LOOP;
  v_tax := ROUND(v_subtotal * v_order.taxrate / (1 + v_order.taxrate), 2);
  v_total := v_subtotal;

  INSERT INTO public.shipments (
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
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;

    INSERT INTO public.shipment_items (
      shipment_id, order_item_id, product_id,
      product_code, product_name, unit_name, qty, unit_price, subtotal
    )
    SELECT
      v_shipment_id,
      (v_item->>'order_item_id')::uuid,
      v_product_id,
      coi.product_code, coi.product_name, coi.unit_name,
      (v_item->>'qty')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric
    FROM public.customer_order_items coi
    WHERE coi.id = (v_item->>'order_item_id')::uuid;

    IF v_product_id IS NOT NULL THEN
      PERFORM public.adjust_inventory(
        v_product_id,
        p_user_id,
        'ship',
        (v_item->>'qty')::integer,
        format('出貨扣庫（%s）', v_ship_code),
        p_depot_id
      );
    END IF;

    UPDATE public.customer_order_items
    SET shipped_qty = shipped_qty + (v_item->>'qty')::numeric
    WHERE id = (v_item->>'order_item_id')::uuid;
  END LOOP;

  UPDATE public.customer_orders SET status = 'shipped' WHERE id = p_order_id;

  RETURN jsonb_build_object('shipment_id', v_shipment_id, 'ship_code', v_ship_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.create_purchase_order(uuid, uuid, text, date, uuid, text, numeric, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shipment_from_order(uuid, uuid, date, uuid, jsonb, text) TO authenticated;
