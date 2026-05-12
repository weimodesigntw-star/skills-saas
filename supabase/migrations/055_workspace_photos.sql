-- ============================================================================
-- Migration 055: 補上 photo_albums / photos 的 workspace RLS + INSERT trigger
-- ============================================================================
-- 背景：052/053/054 上線後發現這兩張表結構是業務型 CMS（status, alt_text,
--      caption, sort_order），雖然目前應用層尚未 query 它們，但為了未來開發
--      不踩到 RLS 隔離雷，提前納入 workspace。
--
-- 風險：極低。若應用層沒有讀寫這兩張表，policy 換掉不影響任何使用流程。
-- 重跑：安全。所有操作以 IF EXISTS / DROP IF EXISTS 包好。
-- 前置：052/053/054 必須先 apply（需要 can_access_workspace、
--      resolve_workspace_owner、enforce_workspace_owner 三個 function）。
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. photo_albums + photos 的 RLS 切換為 workspace
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY['photo_albums', 'photos'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'user_id'
    ) THEN
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;

      EXECUTE format(
        'CREATE POLICY "workspace access" ON public.%I '
        'FOR ALL '
        'USING (public.can_access_workspace(user_id)) '
        'WITH CHECK (public.can_access_workspace(user_id))',
        t
      );

      EXECUTE format('DROP TRIGGER IF EXISTS trg_workspace_owner ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_workspace_owner '
        'BEFORE INSERT ON public.%I '
        'FOR EACH ROW '
        'EXECUTE FUNCTION public.enforce_workspace_owner()',
        t
      );
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 驗證查詢（可選）：
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname='public' AND tablename IN ('photo_albums','photos');
--
--   SELECT event_object_table, trigger_name FROM information_schema.triggers
--   WHERE event_object_table IN ('photo_albums','photos') AND trigger_name='trg_workspace_owner';
-- ---------------------------------------------------------------------------
