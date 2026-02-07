-- ============================================
-- 快速重置配額（最常用）
-- ============================================
-- 使用方法：
-- 1. 替換 'your-email@example.com' 為你的實際郵箱
-- 2. 選擇方法 1 或方法 2 執行
-- ============================================

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
-- SET tier = 'pro'
-- WHERE email = 'your-email@example.com';

-- ============================================
-- 驗證結果
-- ============================================
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN tier = 'pro' THEN '✨ Pro 無限用量'
    WHEN ai_usage_count < 3 THEN CONCAT('✅ 剩餘 ', 3 - ai_usage_count, ' 次')
    ELSE '❌ 已達限制'
  END AS quota_status
FROM profiles
WHERE email = 'your-email@example.com';
