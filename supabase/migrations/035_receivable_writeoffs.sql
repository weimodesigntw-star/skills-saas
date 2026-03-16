-- 應收沖帳主檔
CREATE TABLE IF NOT EXISTS receivable_writeoffs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  writeoff_code TEXT NOT NULL,
  writeoff_date DATE NOT NULL,
  member_id     UUID REFERENCES members(id),
  total_charge  NUMERIC DEFAULT 0,
  discount      NUMERIC DEFAULT 0,
  prepaid_used  NUMERIC DEFAULT 0,
  actual_recd   NUMERIC DEFAULT 0,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receivable_writeoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access" ON receivable_writeoffs;
CREATE POLICY "owner access" ON receivable_writeoffs
  USING (user_id = auth.uid());

-- 沖帳明細
CREATE TABLE IF NOT EXISTS receivable_writeoff_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writeoff_id     UUID NOT NULL REFERENCES receivable_writeoffs(id) ON DELETE CASCADE,
  shipment_id     UUID NOT NULL REFERENCES shipments(id),
  ship_code       TEXT,
  charge_amount   NUMERIC DEFAULT 0,
  writeoff_amount NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE receivable_writeoff_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access via writeoff" ON receivable_writeoff_items;
CREATE POLICY "owner access via writeoff" ON receivable_writeoff_items
  USING (EXISTS (
    SELECT 1 FROM receivable_writeoffs w
    WHERE w.id = receivable_writeoff_items.writeoff_id
    AND w.user_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_writeoffs_user_id ON receivable_writeoffs(user_id);
CREATE INDEX IF NOT EXISTS idx_writeoffs_member_id ON receivable_writeoffs(member_id);
CREATE INDEX IF NOT EXISTS idx_writeoff_items_writeoff_id ON receivable_writeoff_items(writeoff_id);

-- 自動產生沖帳單號
CREATE OR REPLACE FUNCTION generate_writeoff_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM receivable_writeoffs
  WHERE user_id = p_user_id
  AND writeoff_code LIKE 'AR-' || v_today || '-%';
  RETURN 'AR-' || v_today || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 執行沖帳（原子操作）
CREATE OR REPLACE FUNCTION execute_receivable_writeoff(
  p_user_id       UUID,
  p_member_id     UUID,
  p_writeoff_date DATE,
  p_items         JSONB,
  p_discount      NUMERIC DEFAULT 0,
  p_prepaid_used  NUMERIC DEFAULT 0,
  p_note          TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_code TEXT;
  v_writeoff_id UUID;
  v_item JSONB;
  v_total_charge NUMERIC := 0;
  v_actual_recd NUMERIC := 0;
  v_ship RECORD;
BEGIN
  v_code := generate_writeoff_code(p_user_id);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_total_charge := v_total_charge + (v_item->>'writeoff_amount')::NUMERIC;
  END LOOP;
  v_actual_recd := v_total_charge - p_discount - p_prepaid_used;

  INSERT INTO receivable_writeoffs (
    user_id, writeoff_code, writeoff_date, member_id,
    total_charge, discount, prepaid_used, actual_recd, note
  ) VALUES (
    p_user_id, v_code, p_writeoff_date, p_member_id,
    v_total_charge, p_discount, p_prepaid_used, v_actual_recd, p_note
  ) RETURNING id INTO v_writeoff_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_ship FROM shipments
    WHERE id = (v_item->>'shipment_id')::UUID;

    INSERT INTO receivable_writeoff_items (
      writeoff_id, shipment_id, ship_code,
      charge_amount, writeoff_amount
    ) VALUES (
      v_writeoff_id,
      (v_item->>'shipment_id')::UUID,
      v_ship.ship_code,
      v_ship.amt_outstanding,
      (v_item->>'writeoff_amount')::NUMERIC
    );

    UPDATE shipments SET
      amt_recd = amt_recd + (v_item->>'writeoff_amount')::NUMERIC,
      amt_outstanding = GREATEST(
        amt_outstanding - (v_item->>'writeoff_amount')::NUMERIC, 0
      )
    WHERE id = (v_item->>'shipment_id')::UUID;
  END LOOP;

  IF p_prepaid_used > 0 THEN
    UPDATE members SET
      prepaid = GREATEST(prepaid - p_prepaid_used, 0)
    WHERE id = p_member_id;
  END IF;

  RETURN jsonb_build_object('writeoff_id', v_writeoff_id, 'writeoff_code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
