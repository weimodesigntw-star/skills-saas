-- ============================================
-- 原子化 AI 配額檢查與遞增（安全性修復）
-- ============================================
-- 問題：checkAiLimit() 和 incrementAiUsage() 之間無原子操作保護，
--       並行請求可能繞過配額限制。
-- 修復：建立資料庫層級的原子操作函數，
--       在單一交易中完成檢查+遞增。
-- ============================================

-- 原子化配額檢查與消耗函數
-- 返回值：
--   allowed = true  → 配額充足，已自動遞增 ai_usage_count
--   allowed = false → 配額已滿或發生錯誤
CREATE OR REPLACE FUNCTION check_and_increment_ai_usage(
  p_user_id UUID,
  p_daily_limit INTEGER DEFAULT 3
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier TEXT;
  v_usage INTEGER;
  v_last_reset DATE;
  v_today DATE := CURRENT_DATE;
  v_result JSON;
BEGIN
  -- 鎖定該用戶的 profile 行，防止並行修改
  SELECT tier, ai_usage_count, last_reset_date::date
  INTO v_tier, v_usage, v_last_reset
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- 用戶不存在
  IF NOT FOUND THEN
    RETURN json_build_object(
      'allowed', false,
      'error', 'Profile not found'
    );
  END IF;

  -- Pro 用戶：直接允許，不計數
  IF v_tier = 'pro' THEN
    RETURN json_build_object(
      'allowed', true,
      'tier', 'pro',
      'remaining', -1
    );
  END IF;

  -- 如果跨日，重置計數
  IF v_last_reset IS NULL OR v_last_reset < v_today THEN
    v_usage := 0;
  END IF;

  -- 檢查是否超過限制
  IF v_usage >= p_daily_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'tier', v_tier,
      'remaining', 0,
      'limit', p_daily_limit
    );
  END IF;

  -- 原子遞增：檢查通過後立即 +1
  UPDATE profiles
  SET
    ai_usage_count = v_usage + 1,
    last_reset_date = v_today,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object(
    'allowed', true,
    'tier', v_tier,
    'remaining', p_daily_limit - v_usage - 1,
    'limit', p_daily_limit
  );
END;
$$;

-- 授予執行權限
GRANT EXECUTE ON FUNCTION check_and_increment_ai_usage(UUID, INTEGER) TO authenticated;

-- ============================================
-- 使用方式（在應用程式中）：
-- const { data } = await supabase.rpc('check_and_increment_ai_usage', {
--   p_user_id: userId,
--   p_daily_limit: 3
-- });
-- if (data.allowed) { /* 呼叫 AI */ }
-- ============================================
