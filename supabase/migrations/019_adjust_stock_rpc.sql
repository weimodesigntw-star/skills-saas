-- ========================================
-- Migration 019: 庫存調整 RPC（原子操作）
-- 依賴 018 stock_adjustments 表
-- ========================================

CREATE OR REPLACE FUNCTION adjust_stock(
  p_product_id UUID,
  p_user_id    UUID,
  p_type       TEXT,
  p_qty        INTEGER,
  p_note       TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current  INTEGER;
  v_after    INTEGER;
  v_change   INTEGER;
BEGIN
  IF p_type NOT IN ('restock', 'loss', 'manual') THEN
    RAISE EXCEPTION 'invalid type: %', p_type;
  END IF;

  SELECT stock INTO v_current
  FROM products
  WHERE id = p_product_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned';
  END IF;

  v_after := CASE p_type
    WHEN 'restock' THEN v_current + p_qty
    WHEN 'loss'    THEN GREATEST(v_current - p_qty, 0)
    WHEN 'manual'  THEN GREATEST(p_qty, 0)
  END;

  v_change := v_after - v_current;

  UPDATE products SET stock = v_after, updated_at = NOW()
  WHERE id = p_product_id;

  INSERT INTO stock_adjustments
    (user_id, product_id, type, qty_change, qty_after, note)
  VALUES
    (p_user_id, p_product_id, p_type, v_change, v_after, p_note);

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_stock(UUID, UUID, TEXT, INTEGER, TEXT) TO authenticated;
