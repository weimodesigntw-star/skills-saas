-- ============================================
-- 應用 Profiles RLS 備選策略
-- ============================================
-- 這個腳本會替換現有的 RLS 策略為統一的 FOR ALL 策略
-- 使用場景：如果遇到權限問題，可以使用這個更寬鬆的策略
-- ============================================

-- 刪除現有的個別策略
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 創建統一的策略：允許用戶對自己的 profile 做所有操作
CREATE POLICY "Allow all actions for users" 
ON "public"."profiles"
FOR ALL 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 驗證策略已創建
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';
