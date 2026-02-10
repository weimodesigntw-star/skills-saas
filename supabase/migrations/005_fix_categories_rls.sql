-- ============================================
-- 修復 categories RLS 政策（安全性修復）
-- ============================================
-- 問題：原本的 RLS 政策使用 USING (true)，
--       允許任何人讀取、修改、刪除所有用戶的資料。
-- 修復：改為基於 user_id 的權限控制，
--       確保用戶只能操作自己的分類。
-- ============================================

-- 步驟 1：確保 user_id 欄位不為 NULL（未來的資料）
-- 注意：如果現有資料有 NULL user_id，需要先修復
-- UPDATE categories SET user_id = '你的用戶ID' WHERE user_id IS NULL;
-- ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;

-- 步驟 2：刪除原有過於寬鬆的 RLS 政策
DROP POLICY IF EXISTS "Allow public read access" ON categories;
DROP POLICY IF EXISTS "Allow public insert" ON categories;
DROP POLICY IF EXISTS "Allow public update" ON categories;
DROP POLICY IF EXISTS "Allow public delete" ON categories;

-- 步驟 3：建立基於用戶身份的 RLS 政策
-- 用戶只能查看自己的分類
CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

-- 用戶只能新增自己的分類（確保 user_id 設為當前用戶）
CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用戶只能更新自己的分類
CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id);

-- 用戶只能刪除自己的分類
CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- 步驟 4：更新級聯刪除函數的權限
-- 由於 SECURITY DEFINER 會繞過 RLS，我們需要確保函數內部檢查權限
-- （原函數已有 user_id_param 檢查，保持不變）

-- ============================================
-- 驗證指令（可選）：
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'categories';
-- ============================================
