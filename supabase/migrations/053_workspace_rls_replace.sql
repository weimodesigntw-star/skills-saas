-- ============================================================================
-- Migration 053: 替換業務表 RLS policy，改為 workspace 規則
-- ============================================================================
-- 前置：052_workspace_members.sql 必須先 apply（建立 workspace_members 表與
--      can_access_workspace / resolve_workspace_owner 兩個 helper）。
--
-- 策略：
--   Group A — 自帶 user_id 的父表：policy 改為 can_access_workspace(user_id)
--   Group B — 透過父表 EXISTS 的子表：policy 改為 can_access_workspace(父.user_id)
--   特殊  — spec_templates 保留 is_public = TRUE 的公開 SELECT 規則
--   排除  — profiles、shopping_carts 維持個人化（user_id = auth.uid()）
--
-- 安全考量：
--   - 每張表先用 pg_policies 動態 DROP 全部現存 policy，再 CREATE 新的「workspace access」
--     避免新舊 policy 共存造成意外放行
--   - 全程包在 IF EXISTS 內，表不存在時自動跳過（適用於 DB schema 與 repo 不完全同步的情況）
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Group A：自帶 user_id 的父表（27 張）
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'categories',
    'products',
    'orders',
    'invoices',
    'invoice_track_numbers',
    'specifications',
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
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- spec_templates：保留公開模板的 SELECT 權限
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spec_templates'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'spec_templates'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.spec_templates', pol.policyname);
    END LOOP;

    -- 公開模板任何 authenticated 用戶都能 SELECT；workspace 內可讀全部
    EXECUTE $SQL$
      CREATE POLICY "public templates readable"
        ON public.spec_templates
        FOR SELECT
        USING (
          is_public = TRUE
          OR user_id IS NULL
          OR public.can_access_workspace(user_id)
        )
    $SQL$;

    -- workspace 內可管理（user_id IS NULL 是歷史共享資料，保留可寫）
    EXECUTE $SQL$
      CREATE POLICY "workspace manage templates"
        ON public.spec_templates
        FOR ALL
        USING (
          user_id IS NULL
          OR public.can_access_workspace(user_id)
        )
        WITH CHECK (
          user_id IS NULL
          OR public.can_access_workspace(user_id)
        )
    $SQL$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Group B：透過父表 EXISTS 過濾的子表
-- ---------------------------------------------------------------------------

-- order_items via orders
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'order_items'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'order_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.order_items', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.order_items
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND public.can_access_workspace(o.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
              AND public.can_access_workspace(o.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- customer_order_items via customer_orders
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'customer_order_items'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'customer_order_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.customer_order_items', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.customer_order_items
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.customer_orders co
            WHERE co.id = customer_order_items.order_id
              AND public.can_access_workspace(co.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.customer_orders co
            WHERE co.id = customer_order_items.order_id
              AND public.can_access_workspace(co.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- shipment_items via shipments
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shipment_items'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'shipment_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.shipment_items', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.shipment_items
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.shipments s
            WHERE s.id = shipment_items.shipment_id
              AND public.can_access_workspace(s.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.shipments s
            WHERE s.id = shipment_items.shipment_id
              AND public.can_access_workspace(s.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- receivable_writeoff_items via receivable_writeoffs
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'receivable_writeoff_items'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'receivable_writeoff_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.receivable_writeoff_items', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.receivable_writeoff_items
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.receivable_writeoffs w
            WHERE w.id = receivable_writeoff_items.writeoff_id
              AND public.can_access_workspace(w.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.receivable_writeoffs w
            WHERE w.id = receivable_writeoff_items.writeoff_id
              AND public.can_access_workspace(w.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- purchase_order_items via purchase_orders
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'purchase_order_items'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'purchase_order_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.purchase_order_items', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.purchase_order_items
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.purchase_orders po
            WHERE po.id = purchase_order_items.purchase_id
              AND public.can_access_workspace(po.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.purchase_orders po
            WHERE po.id = purchase_order_items.purchase_id
              AND public.can_access_workspace(po.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- payable_writeoff_items via payable_writeoffs
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payable_writeoff_items'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'payable_writeoff_items'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.payable_writeoff_items', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.payable_writeoff_items
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.payable_writeoffs pw
            WHERE pw.id = payable_writeoff_items.writeoff_id
              AND public.can_access_workspace(pw.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.payable_writeoffs pw
            WHERE pw.id = payable_writeoff_items.writeoff_id
              AND public.can_access_workspace(pw.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- product_tag_map via products + product_tags
DO $$
DECLARE pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_tag_map'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'product_tag_map'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.product_tag_map', pol.policyname);
    END LOOP;

    EXECUTE $SQL$
      CREATE POLICY "workspace access"
        ON public.product_tag_map
        FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_tag_map.product_id
              AND public.can_access_workspace(p.user_id)
          )
          AND EXISTS (
            SELECT 1 FROM public.product_tags t
            WHERE t.id = product_tag_map.tag_id
              AND public.can_access_workspace(t.user_id)
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_tag_map.product_id
              AND public.can_access_workspace(p.user_id)
          )
          AND EXISTS (
            SELECT 1 FROM public.product_tags t
            WHERE t.id = product_tag_map.tag_id
              AND public.can_access_workspace(t.user_id)
          )
        )
    $SQL$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 驗證查詢（可選）：
--   SELECT schemaname, tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
-- ---------------------------------------------------------------------------
