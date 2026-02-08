-- ============================================
-- 快速應用 Profiles RLS 備選策略（方法 1）
-- ============================================
-- 執行方式：複製以下 SQL 到 Supabase SQL Editor 執行
-- ============================================

-- 1. 先刪除舊的策略 (以免衝突)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow all actions for users" ON profiles;

-- 2. 建立一個新的統整策略：允許用戶對「自己的資料」進行 CRUD (增查改刪)
CREATE POLICY "Allow all actions for users" ON "public"."profiles"
FOR ALL 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- 3. 驗證策略已創建
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'ALL' THEN '✅ 統一策略（所有操作）'
    WHEN cmd = 'SELECT' THEN 'SELECT 操作'
    WHEN cmd = 'UPDATE' THEN 'UPDATE 操作'
    ELSE cmd::text
  END AS policy_type,
  qual AS condition
FROM pg_policies
WHERE tablename = 'profiles';
