# Lobster Workspace（專案專屬）

此目錄為 **Skills SaaS** 的 Lobster Squad workspace 範本。

## 複製到專案與正確執行流程

**重要：** 必須在**專案根目錄**（有 `supabase/` 與 `lobster-workspace/` 的那一層）執行 watchdog，`../supabase/migrations/` 才會解析到專案的 migration 檔案。從框架目錄執行會找不到檔案。

在專案 repo 內（例如 `skills-saas/` 或 `~/Downloads/skills`）：

```bash
# 1. 進入專案根目錄
cd ~/path/to/skills

# 2. 建立 lobster-workspace（若還沒建）
cp -r ~/SynologyDrive/AI/lobster-squad-v4.2/workspace-template ./lobster-workspace

# 3. 填好 config.json：project_ref + service_role_key
# 4. 從專案根目錄執行（關鍵）
python ~/SynologyDrive/AI/lobster-squad-v4.2/watchdog_router.py \
  --workspace ./lobster-workspace \
  --run-pending
```

若 `config.json` 含 `supabase.service_role_key`，建議將 `lobster-workspace/config.json` 加入專案 `.gitignore`，或改為用環境變數 `SUPABASE_PROJECT_REF`、`SUPABASE_SERVICE_ROLE_KEY`。

## 啟動方式

在專案目錄下執行（框架放在 SynologyDrive）：

```bash
python ~/SynologyDrive/AI/lobster-squad-v4.2/watchdog_router.py \
  --workspace ./lobster-workspace
```

驗證 task、注入 context：

```bash
python ~/SynologyDrive/AI/lobster-squad-v4.2/watchdog_router.py \
  --workspace ./lobster-workspace \
  --validate ./lobster-workspace/tasks/pending/TASK-001.json
```

## run_migration 與 --run-pending

1. **一次性**：在 Supabase SQL Editor 建立 RPC helper：
   ```sql
   CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS void
   LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN EXECUTE query; END; $$;
   ```
2. 在 `config.json` 填寫 `supabase.project_ref`、`supabase.service_role_key`（或設環境變數）。
3. 將 migration task JSON 放入 `tasks/pending/`（檔名建議有序，如 `MIGRATION-016.json`）。
4. 執行：
   ```bash
   python ~/SynologyDrive/AI/lobster-squad-v4.2/watchdog_router.py \
     --workspace ./lobster-workspace --run-pending
   ```
   pending 會依檔名排序執行，結果寫入 `tasks/done/` 或 `tasks/failed/`。

**路徑說明：** 若專案結構是 `專案根/supabase/migrations/` 與 `專案根/lobster-workspace/` 並列，task 的 `migration_file` 請用 `"../supabase/migrations/檔名.sql"`（本範本已預設此路徑）。
