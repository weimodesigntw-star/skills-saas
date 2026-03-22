-- INT-002：客戶訂單應收沖帳（amt_recd）+ 沖帳明細可綁 customer_orders

ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS amt_recd NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE receivable_writeoff_items
  ALTER COLUMN shipment_id DROP NOT NULL;

ALTER TABLE receivable_writeoff_items
  ADD COLUMN IF NOT EXISTS customer_order_id UUID REFERENCES customer_orders(id);

ALTER TABLE receivable_writeoff_items DROP CONSTRAINT IF EXISTS receivable_writeoff_items_one_source;
ALTER TABLE receivable_writeoff_items
  ADD CONSTRAINT receivable_writeoff_items_one_source CHECK (
    (shipment_id IS NOT NULL AND customer_order_id IS NULL)
    OR (shipment_id IS NULL AND customer_order_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_writeoff_items_customer_order_id
  ON receivable_writeoff_items(customer_order_id);

-- 沖帳 RPC：支援 p_items 內含 shipment_id 或 customer_order_id
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
  v_co RECORD;
  v_co_out NUMERIC;
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
    IF (v_item ? 'customer_order_id')
       AND NULLIF(TRIM(v_item->>'customer_order_id'), '') IS NOT NULL THEN
      SELECT * INTO v_co FROM customer_orders
      WHERE id = (v_item->>'customer_order_id')::UUID
        AND user_id = p_user_id
        AND member_id = p_member_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'customer order not found or member mismatch';
      END IF;
      v_co_out := GREATEST((v_co.total::NUMERIC - v_co.amt_recd::NUMERIC), 0);
      IF (v_item->>'writeoff_amount')::NUMERIC > v_co_out THEN
        RAISE EXCEPTION 'writeoff amount exceeds customer order outstanding';
      END IF;
      INSERT INTO receivable_writeoff_items (
        writeoff_id, shipment_id, customer_order_id, ship_code,
        charge_amount, writeoff_amount
      ) VALUES (
        v_writeoff_id,
        NULL,
        v_co.id,
        v_co.order_code,
        v_co_out,
        (v_item->>'writeoff_amount')::NUMERIC
      );
      UPDATE customer_orders SET
        amt_recd = amt_recd + (v_item->>'writeoff_amount')::NUMERIC,
        updated_at = NOW()
      WHERE id = v_co.id;
    ELSE
      SELECT * INTO v_ship FROM shipments
      WHERE id = (v_item->>'shipment_id')::UUID AND user_id = p_user_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'shipment not found';
      END IF;
      INSERT INTO receivable_writeoff_items (
        writeoff_id, shipment_id, customer_order_id, ship_code,
        charge_amount, writeoff_amount
      ) VALUES (
        v_writeoff_id,
        (v_item->>'shipment_id')::UUID,
        NULL,
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
    END IF;
  END LOOP;

  IF p_prepaid_used > 0 THEN
    UPDATE members SET
      prepaid = GREATEST(prepaid - p_prepaid_used, 0)
    WHERE id = p_member_id;
  END IF;

  RETURN jsonb_build_object('writeoff_id', v_writeoff_id, 'writeoff_code', v_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
