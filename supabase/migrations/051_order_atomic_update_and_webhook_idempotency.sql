-- ========================================
-- Migration 051: webhook idempotency + atomic order update RPC
-- ========================================

CREATE TABLE IF NOT EXISTS public.easystore_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop text NOT NULL,
  topic text NOT NULL,
  event_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_easystore_webhook_events_user_event_key
  ON public.easystore_webhook_events(user_id, event_key);

CREATE INDEX IF NOT EXISTS idx_easystore_webhook_events_user_created_at
  ON public.easystore_webhook_events(user_id, created_at DESC);

ALTER TABLE public.easystore_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner access" ON public.easystore_webhook_events;
DROP POLICY IF EXISTS "Users can manage own easystore_webhook_events" ON public.easystore_webhook_events;
CREATE POLICY "Users can manage own easystore_webhook_events"
  ON public.easystore_webhook_events FOR ALL
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_customer_order_atomic(
  p_user_id uuid,
  p_order_id uuid,
  p_advance_date date,
  p_undertaker text,
  p_member_id uuid,
  p_currency text,
  p_tax_type text,
  p_taxrate numeric,
  p_subtotal numeric,
  p_tax_amount numeric,
  p_total numeric,
  p_sales_channel text,
  p_note text,
  p_status text,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_member_id uuid;
  v_order_code text;
  v_rec record;
  v_reserve_qty integer;
BEGIN
  SELECT member_id, order_code
  INTO v_prev_member_id, v_order_code
  FROM public.customer_orders
  WHERE id = p_order_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  FOR v_rec IN
    SELECT product_id, qty, COALESCE(shipped_qty, 0) AS shipped_qty
    FROM public.customer_order_items
    WHERE order_id = p_order_id
      AND product_id IS NOT NULL
  LOOP
    v_reserve_qty := GREATEST(FLOOR(v_rec.qty - v_rec.shipped_qty)::integer, 0);
    IF v_reserve_qty > 0 THEN
      PERFORM public.adjust_inventory(
        v_rec.product_id,
        p_user_id,
        'release',
        v_reserve_qty,
        format('訂單改單釋放保留（%s）', COALESCE(v_order_code, p_order_id::text))
      );
    END IF;
  END LOOP;

  UPDATE public.customer_orders
  SET
    advance_date = p_advance_date,
    undertaker = p_undertaker,
    member_id = p_member_id,
    currency = p_currency,
    tax_type = p_tax_type,
    taxrate = p_taxrate,
    subtotal = p_subtotal,
    tax_amount = p_tax_amount,
    total = p_total,
    sales_channel = p_sales_channel,
    note = p_note,
    status = p_status
  WHERE id = p_order_id
    AND user_id = p_user_id;

  DELETE FROM public.customer_order_items
  WHERE order_id = p_order_id;

  INSERT INTO public.customer_order_items (
    order_id, product_id, product_code, product_name, unit_name, qty, shipped_qty, unit_price,
    discount_pct, subtotal, note, cancelled
  )
  SELECT
    p_order_id,
    NULLIF(elem->>'product_id', '')::uuid,
    NULLIF(elem->>'product_code', ''),
    COALESCE(elem->>'product_name', '(未命名商品)'),
    NULLIF(elem->>'unit_name', ''),
    COALESCE((elem->>'qty')::numeric, 0),
    COALESCE((elem->>'shipped_qty')::numeric, 0),
    COALESCE((elem->>'unit_price')::numeric, 0),
    COALESCE((elem->>'discount_pct')::numeric, 100),
    COALESCE((elem->>'subtotal')::numeric, 0),
    NULLIF(elem->>'note', ''),
    COALESCE((elem->>'cancelled')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS elem;

  FOR v_rec IN
    SELECT product_id, qty, COALESCE(shipped_qty, 0) AS shipped_qty
    FROM public.customer_order_items
    WHERE order_id = p_order_id
      AND product_id IS NOT NULL
  LOOP
    v_reserve_qty := GREATEST(FLOOR(v_rec.qty - v_rec.shipped_qty)::integer, 0);
    IF v_reserve_qty > 0 THEN
      PERFORM public.adjust_inventory(
        v_rec.product_id,
        p_user_id,
        'reserve',
        v_reserve_qty,
        format('訂單改單保留庫存（%s）', COALESCE(v_order_code, p_order_id::text))
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'order_code', v_order_code,
    'prev_member_id', v_prev_member_id,
    'member_id', p_member_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_customer_order_atomic(
  uuid, uuid, date, text, uuid, text, text, numeric, numeric, numeric, numeric, text, text, text, jsonb
) TO authenticated;
