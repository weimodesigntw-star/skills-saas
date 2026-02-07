-- ============================================
-- 快速重置配額 SQL 腳本
-- ============================================
-- 使用方法：
-- 1. 在 Supabase SQL Editor 中執行
-- 2. 替換 'your-email@example.com' 為你的實際郵箱
-- 3. 選擇其中一個方法執行（取消註釋）
-- ============================================

-- ============================================
-- 步驟 0: 查看當前狀態（執行前）
-- ============================================
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

-- ============================================
-- 方法 1: 重置次數為 0（繼續使用 Free 方案）
-- ============================================
UPDATE profiles 
SET ai_usage_count = 0,
    last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- ============================================
-- 方法 2: 直接升級成 Pro（無限暢飲）
-- ============================================
-- UPDATE profiles 
-- SET tier = 'pro',
--     ai_usage_count = 0
-- WHERE email = 'your-email@example.com';

-- ============================================
-- 步驟 3: 驗證結果（執行後）
-- ============================================
SELECT 
  email,
  tier,
  ai_usage_count,
  last_reset_date,
  CASE 
    WHEN tier = 'pro' THEN '✨ Pro 無限用量'
    WHEN ai_usage_count < 3 THEN CONCAT('✅ 剩餘 ', 3 - ai_usage_count, ' 次')
    ELSE '❌ 已達限制'
  END AS quota_status
FROM profiles
WHERE email = 'your-email@example.com';

-- ============================================
-- 其他選項（取消註釋以使用）
-- ============================================

-- 方法 3: 降級為 Free 用戶（測試配額限制）
-- UPDATE profiles 
-- SET tier = 'free',
--     ai_usage_count = 0,
--     last_reset_date = NOW()
-- WHERE email = 'your-email@example.com';

-- 方法 4: 設置為已達限制（測試錯誤訊息）
-- UPDATE profiles 
-- SET tier = 'free',
--     ai_usage_count = 3,
--     last_reset_date = NOW()
-- WHERE email = 'your-email@example.com';
