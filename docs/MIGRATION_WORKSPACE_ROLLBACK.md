# Workspace Migration Rollback

如果 `052/053/054` 三個 migration 在 production 出問題，照下面順序在 Supabase SQL Editor 跑 rollback SQL，**逆序**還原。

> ⚠️ 真的要 rollback 之前，先確認問題不能用「正向修補 migration」解決（例如補一條 policy、加一張漏掉的表）。一旦 rollback，所有納入 workspace 的資料會回到「只有 owner 自己看得到」的狀態，weimoyounga 會立刻失去存取權。

---

## Rollback Step 1：移除 INSERT trigger（還原 054）

```sql
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'categories','products','orders','invoices','invoice_track_numbers',
    'specifications','spec_templates',
    'news','news_categories','news_related',
    'galleries','gallery_photos','video_categories','videos','video_related',
    'stock_adjustments','members','vendors','depots',
    'customer_orders','shipments','receivable_writeoffs',
    'purchase_orders','payable_writeoffs',
    'easystore_integrations','easystore_sync_state','easystore_webhook_events',
    'product_tags','ai_generation_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_workspace_owner ON public.%I', t);
    END IF;
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.enforce_workspace_owner();
```

## Rollback Step 2：還原 RLS policy 為 user_id = auth.uid()（還原 053）

```sql
-- 父表（Group A）
DO $$
DECLARE
  t text;
  pol record;
  tables text[] := ARRAY[
    'categories','products','orders','invoices','invoice_track_numbers',
    'specifications',
    'news','news_categories','news_related',
    'galleries','gallery_photos','video_categories','videos','video_related',
    'stock_adjustments','members','vendors','depots',
    'customer_orders','shipments','receivable_writeoffs',
    'purchase_orders','payable_writeoffs',
    'easystore_integrations','easystore_sync_state','easystore_webhook_events',
    'product_tags','ai_generation_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format(
        'CREATE POLICY "owner access" ON public.%I FOR ALL '
        'USING (auth.uid() = user_id) '
        'WITH CHECK (auth.uid() = user_id)',
        t
      );
    END IF;
  END LOOP;
END $$;

-- spec_templates（保留 public read）
DO $$
DECLARE pol record;
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
    CREATE POLICY "Users can view public templates"
      ON public.spec_templates FOR SELECT
      USING (is_public = TRUE OR auth.uid() = user_id);
    CREATE POLICY "Users can manage own templates"
      ON public.spec_templates FOR ALL
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- 子表（Group B）— 用原本「auth.uid() = 父.user_id」規則
-- 為避免文件過長，這裡只列 order_items 作為範例；其餘子表照樣 DROP ALL + CREATE。
-- 完整 rollback 可比照 supabase/migrations/008、010、030、033、035、037、038、049 中的原始 policy。

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
    CREATE POLICY "Users can view own order items"
      ON public.order_items FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM public.orders o
          WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
        )
      );
  END IF;
END $$;
```

對其他子表（`customer_order_items`、`shipment_items`、`receivable_writeoff_items`、`purchase_order_items`、`payable_writeoff_items`、`product_tag_map`）參照 [`supabase/migrations/030_customer_order_items.sql`](../supabase/migrations/030_customer_order_items.sql)、`033`、`035`、`037`、`038`、`049` 內的原始 CREATE POLICY 區塊回填。

## Rollback Step 3：移除 workspace 表與 helper（還原 052）

```sql
-- 確認上面兩步已完成後執行
DROP FUNCTION IF EXISTS public.can_access_workspace(uuid);
DROP FUNCTION IF EXISTS public.resolve_workspace_owner();
DROP TABLE IF EXISTS public.workspace_members;
```

---

## 緊急情況：只想暫時讓 weimoyounga 失去存取權，不想 rollback 全部

最快的方式是刪除 mapping，不必動 schema：

```sql
DELETE FROM public.workspace_members
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'weimodesigntw@gmail.com')
  AND member_id = (SELECT id FROM auth.users WHERE email = 'weimoyounga@gmail.com');
```

之後再重新加回：

```sql
INSERT INTO public.workspace_members (owner_id, member_id)
SELECT
  (SELECT id FROM auth.users WHERE email = 'weimodesigntw@gmail.com'),
  (SELECT id FROM auth.users WHERE email = 'weimoyounga@gmail.com')
ON CONFLICT DO NOTHING;
```
