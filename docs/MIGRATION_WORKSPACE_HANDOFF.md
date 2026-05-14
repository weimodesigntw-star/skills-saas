# Workspace Migration 操作交接（給另一邊 AI / DBA）

> 接手者：能直接操作 Supabase MCP（`list_tables`、`execute_sql`、`apply_migration`、`create_branch`、`get_advisors`）的 agent / 人員。
> 來源 repo：`weimodesigntw-star/skills-saas`（branch `main`）。

## 任務總覽

讓 `weimojay@gmail.com`（workspace owner）、`weimodesigntw@gmail.com`、`weimoyounga@gmail.com` 共用同一份業務資料。
作法是新增 `workspace_members` 對映表 + 改寫所有業務表 RLS policy + 加 `BEFORE INSERT` trigger，自動把寫入的 `user_id` 改成 workspace owner。

**Application code 完全不需要動**（已驗證 `middleware.ts`、`app/dashboard/layout.tsx` 都沒有 admin 判斷邏輯）。

## 要 apply 的 migration（已在 repo `supabase/migrations/`）

1. `052_workspace_members.sql` — 建表 + 兩個 helper function + 用 email 動態寫入兩筆 mapping
2. `053_workspace_rls_replace.sql` — 替換 27 張父表 + 8 張子表 + spec_templates 特殊規則
3. `054_workspace_insert_triggers.sql` — `enforce_workspace_owner` trigger 掛到所有共用父表

排除（保留 `user_id = auth.uid()`）：`profiles`、`shopping_carts`。

## 建議執行流程（用 preview branch 驗證後再合併）

### Step 0：前置確認

```sql
-- 0.1 確認三個帳號都已註冊
SELECT id, email, created_at
FROM auth.users
WHERE email IN ('weimojay@gmail.com', 'weimodesigntw@gmail.com', 'weimoyounga@gmail.com');
-- 期望：三列。若任一帳號缺，請用戶先到 Supabase Auth → Users → Add user 建立。

-- 0.2 確認 codebase 上 052/053/054 中提到的可疑表是否實際存在於 DB
SELECT
  c.table_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = c.table_name AND column_name = 'user_id'
  ) AS has_user_id
FROM information_schema.tables c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'ai_generation_logs',
    'easystore_webhook_events','easystore_sync_state','easystore_integrations',
    'news_categories','news_related',
    'payments','payment_logs','photo_albums','photos'
  )
ORDER BY c.table_name;
```

- 若 `ai_generation_logs` 不存在 → migration 用 `IF EXISTS` 已自動跳過，不需處理。
- 若 `news_categories`、`news_related`、`easystore_webhook_events` 不存在 → 表示 DB 沒跑完 migration `012`、`051`，**請先補跑這兩個** 後再執行 052/053/054。
- 若 `payments`、`payment_logs`、`photo_albums`、`photos` 真的存在且有 `user_id` → 把表名追加到 053 的 Group A `tables` 陣列以及 054 同名清單，再 apply。

### Step 1：建 preview branch

```
create_branch(name="workspace-rls")
```

### Step 2：在 branch 上依序 apply

```
apply_migration(name="052_workspace_members", query=<檔案內容>)
apply_migration(name="053_workspace_rls_replace", query=<檔案內容>)
apply_migration(name="054_workspace_insert_triggers", query=<檔案內容>)
```

每一步後跑 `get_advisors(type="security")` 檢查 lint。預期：
- 不應有 `policy_exists_rls_disabled` 警告
- 不應有 `rls_disabled_in_public` 警告

### Step 3：在 branch 驗證

```sql
-- 3.1 workspace mapping 是否寫成功
SELECT
  wo.email AS owner_email,
  wm.email AS member_email
FROM public.workspace_members
JOIN auth.users wo ON wo.id = owner_id
JOIN auth.users wm ON wm.id = member_id;
-- 期望：三列。owner 自己 (weimojay, weimojay) + (weimojay, weimodesigntw) + (weimojay, weimoyounga)

-- 3.2 helper 函數驗證
-- 用 service role 跑（auth.uid() 為 NULL，會 fallback 為 NULL）
SELECT public.resolve_workspace_owner();           -- NULL (service role)
SELECT public.can_access_workspace(
  (SELECT id FROM auth.users WHERE email = 'weimojay@gmail.com')
);                                                  -- FALSE (service role)

-- 3.3 確認所有目標表都掛上 trigger
SELECT event_object_table AS table_name
FROM information_schema.triggers
WHERE trigger_name = 'trg_workspace_owner'
ORDER BY table_name;
-- 期望：包含 customer_orders、products、orders、members 等共用表。

-- 3.4 確認 profiles / shopping_carts 沒有被掛 trigger
SELECT 1 FROM information_schema.triggers
WHERE trigger_name = 'trg_workspace_owner'
  AND event_object_table IN ('profiles', 'shopping_carts');
-- 期望：零列。

-- 3.5 確認所有業務表的 policy 都改名為「workspace access」
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname NOT IN ('workspace access', 'public templates readable',
                         'workspace manage templates',
                         'members can read own mappings',
                         -- profiles、shopping_carts 保留原名
                         'Users can view own profile',
                         'Users can update own profile',
                         'Allow all actions for users',
                         'Users can manage own cart')
ORDER BY tablename;
-- 期望：零列（除了上述例外）。
```

### Step 4：用兩個帳號實測（最關鍵）

從前端網站，分別用 `weimojay`、`weimodesigntw`、`weimoyounga` 登入，每人各做：

1. 訪問 `/dashboard/orders` — 是否看到同一份訂單列表
2. 訪問 `/dashboard/products` — 是否看到同一份商品列表
3. 訪問 `/dashboard/members` — 是否看到同一份會員列表
4. weimoyounga 新建一筆訂單 → 切回 weimojay（或 weimodesigntw）是否看得到、且該訂單的 `user_id` 應為 weimojay 的 UID

```sql
-- weimoyounga 建單後跑這條確認 user_id 被自動 map
SELECT user_id, order_code, created_at
FROM public.customer_orders
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;
-- 期望：user_id = weimojay 的 UID（即使是 weimoyounga 建的）
```

### Step 5：合併到 main

驗證全部通過後：

```
merge_branch(branch_name="workspace-rls")
```

## 出問題時

- 任何一步驗證失敗 → 不要合 main，直接砍 branch 重來。
- 已合 main 後才發現問題 → 參考 [`docs/MIGRATION_WORKSPACE_ROLLBACK.md`](./MIGRATION_WORKSPACE_ROLLBACK.md) 或先用「刪除 mapping」緊急切斷 weimoyounga 存取權。

## FAQ

**Q：所有現有 RPC（如 `update_customer_order_atomic`、`adjust_inventory`）會不會壞？**
A：RPC 內部用 `p_user_id` 參數而非 `auth.uid()`，server action 呼叫時會傳 `auth.uid()`。member 呼叫時 `p_user_id = member.uid`，但訂單的 `user_id` 是 owner.uid，所以 `WHERE user_id = p_user_id` 會 miss。**需要在 server action 層把 `p_user_id` 改為 `resolve_workspace_owner()` 的回傳值**。

- 影響的 server action：`app/actions/customer-orders.ts`、`app/actions/shipments.ts`、`app/actions/purchase-orders.ts`、`app/actions/inventory.ts` 等所有呼叫 RPC 的地方。
- **後續工作 P0**：交接給有 codebase 編輯權限的 agent（不會由這邊處理），追加一個 helper 函式 `getWorkspaceOwnerId(supabase)`，並把 RPC 呼叫處的 `user.id` 全部替換。**沒做這步，member 操作會看得到資料但改不動。**

**Q：member 用 server-side INSERT（如 server action）寫入時 user_id 怎麼判斷？**
A：trigger `enforce_workspace_owner` 會強制把 `NEW.user_id` 改為 `resolve_workspace_owner()`，所以即使 server action 寫 `user.id`，最終存進 DB 的是 owner.id，下次 SELECT 透過 RLS 兩人都看得到。

**Q：未來要加第 3、4 個 member 怎麼做？**
A：直接 `INSERT INTO public.workspace_members (owner_id, member_id) VALUES (...)` 即可，不必再動 schema。
