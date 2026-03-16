-- 應付沖帳表（須在 RPC 前建立）
CREATE TABLE IF NOT EXISTS payable_writeoffs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id),
  writeoff_code  TEXT NOT NULL,
  writeoff_date  DATE NOT NULL,
  vendor_id      UUID REFERENCES vendors(id),
  total_charge   NUMERIC DEFAULT 0,
  discount       NUMERIC DEFAULT 0,
  actual_paid    NUMERIC DEFAULT 0,
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payable_writeoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access" ON payable_writeoffs;
CREATE POLICY "owner access" ON payable_writeoffs USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_payable_writeoffs_user_id ON payable_writeoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_payable_writeoffs_vendor_id ON payable_writeoffs(vendor_id);

CREATE TABLE IF NOT EXISTS payable_writeoff_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writeoff_id     UUID NOT NULL REFERENCES payable_writeoffs(id) ON DELETE CASCADE,
  purchase_id     UUID NOT NULL REFERENCES purchase_orders(id),
  receive_code    TEXT,
  charge_amount   NUMERIC DEFAULT 0,
  writeoff_amount NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payable_writeoff_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access via writeoff" ON payable_writeoff_items;
CREATE POLICY "owner access via writeoff" ON payable_writeoff_items
  USING (EXISTS (
    SELECT 1 FROM payable_writeoffs pw
    WHERE pw.id = payable_writeoff_items.writeoff_id
    AND pw.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_payable_items_writeoff_id ON payable_writeoff_items(writeoff_id);

-- 採購單號
CREATE OR REPLACE FUNCTION generate_purchase_code(p_user_id UUID, p_prefix TEXT DEFAULT 'CA202')
RETURNS TEXT AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM purchase_orders
  WHERE user_id = p_user_id
  AND receive_code LIKE p_prefix || '-' || v_today || '-%';
  RETURN p_prefix || '-' || v_today || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 建立採購單（原子：建單 + 增庫存）
CREATE OR REPLACE FUNCTION create_purchase_order(
  p_user_id    UUID,
  p_vendor_id  UUID,
  p_vendor_name TEXT,
  p_receive_day DATE,
  p_depot_id   UUID,
  p_tax_type   TEXT,
  p_taxrate    NUMERIC,
  p_items      JSONB,
  p_note       TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
  v_purchase_id UUID;
  v_item JSONB;
  v_subtotal NUMERIC := 0;
  v_tax NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item_sub NUMERIC;
BEGIN
  v_code := generate_purchase_code(p_user_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_sub := (v_item->>'qty')::NUMERIC * (v_item->>'unit_price')::NUMERIC;
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

  INSERT INTO purchase_orders (
    user_id, receive_code, receive_day, vendor_id, vendor_name,
    depot_id, currency, tax_type, taxrate,
    subtotal, tax_amount, total, amt_unpaid, note, status
  ) VALUES (
    p_user_id, v_code, p_receive_day, p_vendor_id, p_vendor_name,
    p_depot_id, '台幣', p_tax_type, p_taxrate,
    v_subtotal, v_tax, v_total, v_total, p_note, 'valid'
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_sub := (v_item->>'qty')::NUMERIC * (v_item->>'unit_price')::NUMERIC;

    INSERT INTO purchase_order_items (
      purchase_id, product_id, product_code,
      product_name, unit_name, qty, unit_price, subtotal
    ) VALUES (
      v_purchase_id,
      NULLIF(v_item->>'product_id', '')::UUID,
      v_item->>'product_code',
      v_item->>'product_name',
      v_item->>'unit_name',
      (v_item->>'qty')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      v_item_sub
    );

    IF v_item->>'product_id' IS NOT NULL AND v_item->>'product_id' != '' THEN
      UPDATE products
      SET stock = stock + (v_item->>'qty')::NUMERIC
      WHERE id = NULLIF(v_item->>'product_id', '')::UUID;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('purchase_id', v_purchase_id, 'receive_code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 應付沖帳單號
CREATE OR REPLACE FUNCTION generate_payable_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM payable_writeoffs
  WHERE user_id = p_user_id
  AND writeoff_code LIKE 'AP-' || v_today || '-%';
  RETURN 'AP-' || v_today || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 應付沖帳
CREATE OR REPLACE FUNCTION execute_payable_writeoff(
  p_user_id      UUID,
  p_vendor_id    UUID,
  p_writeoff_date DATE,
  p_items        JSONB,
  p_discount     NUMERIC DEFAULT 0,
  p_note         TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
  v_writeoff_id UUID;
  v_item JSONB;
  v_total_charge NUMERIC := 0;
  v_actual_paid NUMERIC := 0;
  v_po RECORD;
BEGIN
  v_code := generate_payable_code(p_user_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_charge := v_total_charge + (v_item->>'writeoff_amount')::NUMERIC;
  END LOOP;
  v_actual_paid := v_total_charge - p_discount;

  INSERT INTO payable_writeoffs (
    user_id, writeoff_code, writeoff_date, vendor_id,
    total_charge, discount, actual_paid, note
  ) VALUES (
    p_user_id, v_code, p_writeoff_date, p_vendor_id,
    v_total_charge, p_discount, v_actual_paid, p_note
  ) RETURNING id INTO v_writeoff_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_po FROM purchase_orders WHERE id = (v_item->>'purchase_id')::UUID;

    INSERT INTO payable_writeoff_items (
      writeoff_id, purchase_id, receive_code,
      charge_amount, writeoff_amount
    ) VALUES (
      v_writeoff_id,
      (v_item->>'purchase_id')::UUID,
      v_po.receive_code,
      v_po.amt_unpaid,
      (v_item->>'writeoff_amount')::NUMERIC
    );

    UPDATE purchase_orders SET
      amt_paid = amt_paid + (v_item->>'writeoff_amount')::NUMERIC,
      amt_unpaid = GREATEST(amt_unpaid - (v_item->>'writeoff_amount')::NUMERIC, 0)
    WHERE id = (v_item->>'purchase_id')::UUID;
  END LOOP;

  RETURN jsonb_build_object('writeoff_id', v_writeoff_id, 'writeoff_code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
