-- ============================================
-- 快速配額測試 SQL 腳本
-- ============================================
-- 使用方法：
-- 1. 在 Supabase SQL Editor 中執行
-- 2. 替換 'your-email@example.com' 為你的實際郵箱
-- 3. 按順序執行每個區塊
-- ============================================

-- ============================================
-- 步驟 1：檢查資料庫結構
-- ============================================
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('tier', 'ai_usage_count', 'last_reset_date', 'stripe_customer_id', 'stripe_subscription_id')
ORDER BY column_name;

-- ============================================
-- 步驟 2：查看當前用戶配額狀態
-- ============================================
-- 替換 'your-email@example.com' 為你的實際郵箱
SELECT 
  email,
  tier,
  ai_usage_count,
  last_reset_date,
  CASE 
    WHEN tier = 'pro' THEN '無限制'
    WHEN ai_usage_count < 3 THEN CONCAT('剩餘 ', 3 - ai_usage_count, ' 次')
    ELSE '已達限制'
  END AS quota_status,
  CASE 
    WHEN tier = 'pro' THEN true
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- 步驟 3：測試場景 1 - 重置為初始狀態（未達限制）
-- ============================================
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 0,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- 驗證
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed,
  3 - ai_usage_count AS remaining
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- 步驟 4：測試場景 2 - 設置為已達限制
-- ============================================
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 3,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- 驗證（應該 allowed = false）
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed,
  3 - ai_usage_count AS remaining
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- 步驟 5：測試場景 3 - 測試每日重置邏輯
-- ============================================
-- 設置為昨天，已達限制
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 3,
  last_reset_date = NOW() - INTERVAL '1 day'
WHERE email = 'your-email@example.com';

-- 檢查是否需要重置（模擬 checkAiLimit 邏輯）
SELECT 
  email,
  ai_usage_count AS current_count,
  last_reset_date,
  DATE(last_reset_date) AS reset_date_only,
  CURRENT_DATE AS today,
  DATE(last_reset_date) < CURRENT_DATE AS should_reset,
  CASE 
    WHEN DATE(last_reset_date) < CURRENT_DATE THEN 0
    ELSE ai_usage_count
  END AS count_after_reset
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- 步驟 6：測試場景 4 - 升級為 Pro 用戶
-- ============================================
UPDATE profiles 
SET 
  tier = 'pro',
  ai_usage_count = 0
WHERE email = 'your-email@example.com';

-- 驗證（應該 allowed = true，無論 ai_usage_count 是多少）
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN tier = 'pro' THEN true
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- 步驟 7：恢復為 Free 用戶（測試完成後）
-- ============================================
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 0,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- 最終驗證
SELECT 
  email,
  tier,
  ai_usage_count,
  last_reset_date,
  CASE 
    WHEN tier = 'pro' THEN '無限制'
    WHEN ai_usage_count < 3 THEN CONCAT('剩餘 ', 3 - ai_usage_count, ' 次')
    ELSE '已達限制'
  END AS quota_status
FROM profiles
WHERE email = 'your-email@example.com';
