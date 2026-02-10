-- ============================================
-- 變更 sort_order 欄位類型為 DOUBLE PRECISION
-- ============================================
-- 問題：sort_order 原為 INTEGER，但程式碼中使用
--       浮點數運算（Fractional Indexing），
--       INTEGER 無法儲存小數導致精度遺失。
-- 修復：變更為 DOUBLE PRECISION 以支援浮點排序。
-- ============================================

ALTER TABLE categories
ALTER COLUMN sort_order TYPE DOUBLE PRECISION
USING sort_order::DOUBLE PRECISION;

-- 設定預設值
ALTER TABLE categories
ALTER COLUMN sort_order SET DEFAULT 0.0;

-- ============================================
-- 驗證指令（可選）：
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'categories' AND column_name = 'sort_order';
-- ============================================
