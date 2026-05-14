-- ============================================================================
-- Migration 052: Workspace 多帳號協作 — 基礎建設
-- ============================================================================
-- 目的：讓多個 auth.users 共用同一份業務資料（員工協作型）。
--
-- 模型：
--   workspace_members(owner_id, member_id) 代表「member_id 能存取屬於 owner_id 的資料」。
--   owner 自己以 (owner_id = self, member_id = self) 寫入一筆，方便 helper 一律走表。
--
-- 不變式：
--   所有業務表的 RLS 與 INSERT trigger 都會通過 workspace_members 過濾。
--   要撤銷某成員的存取權限，只需刪除其 mapping，不必動 application code。
--
-- 注意：
--   - 此 migration 不影響 profiles 與 shopping_carts（兩者保持個人化）。
--   - 任一成員若尚未在 Supabase Auth 註冊，對應 INSERT 會自動跳過（不會報錯），
--     日後可重跑這段補上。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. workspace_members 表
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_members (
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_member_id
  ON public.workspace_members(member_id);

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read own mappings" ON public.workspace_members;
CREATE POLICY "members can read own mappings"
  ON public.workspace_members
  FOR SELECT
  USING (member_id = auth.uid() OR owner_id = auth.uid());

-- mapping 的 INSERT/UPDATE/DELETE 留給 service role 維護（未來改為後台管理頁時再開）。

-- ---------------------------------------------------------------------------
-- 2. Helper: resolve_workspace_owner()
-- ---------------------------------------------------------------------------
-- 回傳當前 auth.uid() 所屬 workspace 的 owner_id。
-- - 若在 workspace_members 找到對應 mapping，回傳 owner_id
-- - 否則 fallback 回 auth.uid()（新用戶自成 workspace；向後相容）
CREATE OR REPLACE FUNCTION public.resolve_workspace_owner() RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT owner_id
       FROM public.workspace_members
      WHERE member_id = auth.uid()
      ORDER BY created_at ASC
      LIMIT 1),
    auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Helper: can_access_workspace(target uuid)
-- ---------------------------------------------------------------------------
-- 當前 auth.uid() 是否能存取屬於 target 的資料。
CREATE OR REPLACE FUNCTION public.can_access_workspace(target uuid) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE owner_id = target AND member_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_workspace_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_workspace(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. 初始 workspace mapping
-- ---------------------------------------------------------------------------
-- Owner：weimojay@gmail.com（業務資料實際擁有人）
-- Members：weimojay 自己 + weimodesigntw@gmail.com + weimoyounga@gmail.com
--
-- 用 email 動態查 UID，避免 hardcode 寫死。任一帳號尚未在 Supabase Auth 註冊時，
-- 對應的 row 會自動跳過（不會報錯），日後可重跑這段補上。

INSERT INTO public.workspace_members (owner_id, member_id)
SELECT
  (SELECT id FROM auth.users WHERE email = 'weimojay@gmail.com'),
  m.id
FROM auth.users m
WHERE m.email IN (
  'weimojay@gmail.com',
  'weimodesigntw@gmail.com',
  'weimoyounga@gmail.com'
)
  AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'weimojay@gmail.com')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 驗證查詢（可選，apply 後手動跑）：
--   SELECT
--     wo.email AS owner_email,
--     wm.email AS member_email,
--     workspace_members.created_at
--   FROM public.workspace_members
--   JOIN auth.users wo ON wo.id = workspace_members.owner_id
--   JOIN auth.users wm ON wm.id = workspace_members.member_id;
-- ---------------------------------------------------------------------------
