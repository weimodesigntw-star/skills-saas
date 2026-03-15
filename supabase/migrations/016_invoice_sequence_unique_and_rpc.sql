-- ========================================
-- Migration 016: 字軌唯一啟用 + 取號 RPC
-- 1. 同一 user 僅允許一筆 is_active = true
-- 2. get_next_invoice_number 原子取號
-- ========================================

-- 只允許一筆啟用中的字軌（per user）
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_track_numbers_one_active_per_user
  ON invoice_track_numbers (user_id)
  WHERE is_active = TRUE;

-- 原子取號：FOR UPDATE 鎖定列，current_number+1 後更新並回傳發票號碼字串（前綴+8碼）
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_track_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_prefix TEXT;
  v_next INTEGER;
  v_end_num INTEGER;
  v_number_str TEXT;
BEGIN
  SELECT user_id, track_prefix, current_number, end_number
  INTO v_user_id, v_prefix, v_next, v_end_num
  FROM invoice_track_numbers
  WHERE id = p_track_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '字軌不存在或無權限';
  END IF;

  IF v_next > v_end_num THEN
    RAISE EXCEPTION '字軌號碼已用罄 (current: %, end: %)', v_next, v_end_num;
  END IF;

  v_next := v_next + 1;
  UPDATE invoice_track_numbers
  SET current_number = v_next
  WHERE id = p_track_id;

  v_number_str := v_prefix || LPAD(v_next::TEXT, 8, '0');
  RETURN v_number_str;
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_invoice_number(UUID) TO authenticated;
