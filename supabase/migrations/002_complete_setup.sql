-- ============================================
-- 完整數據庫設置腳本 (One-Shot Setup)
-- ============================================
-- 此腳本整合了：
-- 1. categories 表創建
-- 2. 索引優化
-- 3. RLS 安全策略
-- 4. 級聯刪除函數
-- 
-- 執行方式：在 Supabase SQL Editor 中一次性執行
-- ============================================

-- ============================================
-- 1. 建立 categories 表格
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, -- 可選：如果未來需要用戶隔離
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE, -- 自關聯，實現無限層級
  sort_order INTEGER DEFAULT 0, -- 排序順序
  path TEXT, -- 路徑（用於快速查詢）
  spec_data JSONB DEFAULT '{}'::JSONB, -- 核心：JSONB 存儲動態規格
  metadata JSONB DEFAULT '{}'::JSONB, -- 額外元數據
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 建立索引 (為了效能)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_path ON categories(path) WHERE path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categories_spec_data ON categories USING GIN (spec_data); -- JSONB GIN 索引

-- ============================================
-- 3. 啟用 RLS (Row Level Security) - 安全防護
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- 開發階段：允許所有人讀取和操作（方便測試）
-- 生產環境：應改為僅限 Authenticated 用戶

-- 刪除現有策略（如果存在）
DROP POLICY IF EXISTS "Allow public read access" ON categories;
DROP POLICY IF EXISTS "Allow public insert" ON categories;
DROP POLICY IF EXISTS "Allow public update" ON categories;
DROP POLICY IF EXISTS "Allow public delete" ON categories;

-- 創建新策略
CREATE POLICY "Allow public read access" 
  ON categories FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert" 
  ON categories FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update" 
  ON categories FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete" 
  ON categories FOR DELETE 
  USING (true);

-- ============================================
-- 4. 建立更新時間觸發器函數（如果還沒有）
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為 categories 表添加更新時間觸發器
DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 建立級聯刪除函數 (The Atomic Bomb Logic)
-- ============================================
CREATE OR REPLACE FUNCTION delete_category_cascade(
  category_id UUID,
  user_id_param UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- 檢查權限（如果提供了 user_id）
  IF user_id_param IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM categories 
      WHERE id = category_id 
      AND (user_id = user_id_param OR user_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Category not found or unauthorized';
    END IF;
  END IF;

  -- 使用遞迴 CTE 找出所有子孫節點
  WITH RECURSIVE category_tree AS (
    -- 基礎：目標節點
    SELECT id FROM categories WHERE id = category_id
    
    UNION ALL
    
    -- 遞迴：找出子節點
    SELECT c.id FROM categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
    WHERE (user_id_param IS NULL OR c.user_id = user_id_param OR c.user_id IS NULL)
  )
  -- 刪除所有找到的節點（在單一事務中）
  DELETE FROM categories 
  WHERE id IN (SELECT id FROM category_tree);
  
  -- 獲取受影響的行數
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  -- 如果沒有刪除任何行，拋出異常
  IF affected_count = 0 THEN
    RAISE EXCEPTION 'Failed to delete category: category not found';
  END IF;
END;
$$;

-- 授予執行權限
GRANT EXECUTE ON FUNCTION delete_category_cascade(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_category_cascade(UUID, UUID) TO anon;

-- ============================================
-- 6. 驗證設置（可選）
-- ============================================
-- 執行以下查詢確認設置成功：
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories';
-- SELECT proname FROM pg_proc WHERE proname = 'delete_category_cascade';

-- ============================================
-- 完成！
-- ============================================
-- 現在您可以：
-- 1. 在應用中使用 categories 表
-- 2. 使用 delete_category_cascade() 函數進行級聯刪除
-- 3. 開始插入測試數據
