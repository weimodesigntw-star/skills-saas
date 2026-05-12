-- ============================================================================
-- Migration 054: INSERT trigger — 自動把 user_id 寫成 workspace owner
-- ============================================================================
-- 前置：052、053 必須先 apply。
--
-- 目的：讓 application code 不必修改。
--   - 過去 server action / RPC 都用 auth.uid() 寫入 user_id
--   - 加上這個 trigger 後，任何 INSERT 進業務表的 user_id 都會被自動改寫為
--     resolve_workspace_owner()，也就是該 auth user 所屬 workspace 的 owner_id
--   - Owner 自己寫入時 owner_id == auth.uid()，邏輯等價於原本行為
--   - Member 寫入時 owner_id 是 owner 的 UID，資料歸屬給 owner，所有 workspace
--     成員（包含 owner 自己）都能透過 053 的 RLS 看到
--
-- 排除：
--   - profiles：個人資料表，原 RLS 用 id（PK == auth.uid()）判斷，不適用
--   - shopping_carts：個人購物車，必須維持 user_id = auth.uid()
--   - 所有子表（order_items 等）：沒有 user_id 欄位
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. enforce_workspace_owner trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_workspace_owner() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 只在沒有顯式指定 user_id（為 NULL）或指定為 auth.uid() 時 map
  -- 這樣允許 service role 或特殊情境顯式寫入別人的 user_id（例如系統腳本）
  IF NEW.user_id IS NULL OR NEW.user_id = auth.uid() THEN
    NEW.user_id := public.resolve_workspace_owner();
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enforce_workspace_owner() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. 為所有納入 workspace 共用的父表掛上 BEFORE INSERT trigger
-- ---------------------------------------------------------------------------
-- 注意：profiles、shopping_carts 不在清單內（個人化）。
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'categories',
    'products',
    'orders',
    'invoices',
    'invoice_track_numbers',
    'specifications',
    'spec_templates',
    'news',
    'news_categories',
    'news_related',
    'galleries',
    'gallery_photos',
    'video_categories',
    'videos',
    'video_related',
    'stock_adjustments',
    'members',
    'vendors',
    'depots',
    'customer_orders',
    'shipments',
    'receivable_writeoffs',
    'purchase_orders',
    'payable_writeoffs',
    'easystore_integrations',
    'easystore_sync_state',
    'easystore_webhook_events',
    'product_tags',
    'ai_generation_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'user_id'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_workspace_owner ON public.%I',
        t
      );
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
--   SELECT event_object_table AS table_name, trigger_name
--   FROM information_schema.triggers
--   WHERE trigger_name = 'trg_workspace_owner'
--   ORDER BY table_name;
-- ---------------------------------------------------------------------------
