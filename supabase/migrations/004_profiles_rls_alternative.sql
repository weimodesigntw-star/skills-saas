-- ============================================
-- Profiles RLS 備選策略
-- ============================================
-- 這個策略允許 authenticated 用戶對自己的 profile 做任何操作
-- 使用 FOR ALL 簡化策略管理
-- ============================================

-- 刪除現有的個別策略（如果存在）
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 創建統一的策略：允許用戶對自己的 profile 做所有操作
CREATE POLICY "Allow all actions for users" 
ON "public"."profiles"
FOR ALL 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 說明：
-- USING: 用於 SELECT, UPDATE, DELETE（檢查現有行）
-- WITH CHECK: 用於 INSERT, UPDATE（檢查新行）
-- 這樣可以確保用戶只能操作自己的 profile
