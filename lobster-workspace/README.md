# Lobster Workspace（專案專屬）

此目錄為 **Skills SaaS** 的 Lobster Squad workspace 範本。

## 最快啟動（本 repo 已內建腳本）

在**專案根目錄**（與 `package.json` 同層）：

```bash
# 顯示 help + 目前 config（敏感 key 會遮罩）
npm run lobster

# 驗證單一 task（例：TAGS-001）
npm run lobster:validate-tags

# 或直接用腳本（可傳 watchdog 任何參數）
./scripts/run-lobster.sh --validate lobster-workspace/tasks/pending/TAGS-001.json
./scripts/run-lobster.sh --inject-context lobster-workspace/tasks/pending/TAGS-001.json
```

腳本會自動找本機常見路徑：

- `~/Library/CloudStorage/SynologyDrive-M4/AI/lobster-squad-v4.2/watchdog_router.py`
- 備援：`~/lobster-squad-v4.1/watchdog_router.py`

若路徑不同，請設定：

```bash
export LOBSTER_WATCHDOG=/你的路徑/lobster-squad-v4.2/watchdog_router.py
npm run lobster
```

**`write_code` 任務**：需安裝 `pip install anthropic`，並在環境變數或 `config.json` 設定 `ANTHROPIC_API_KEY`（或 `anthropic.api_key`）。任務 JSON 須含 **`spec_file`**（相對於本 workspace），例如 TAGS-001 已指向 `../docs/TAGS-001_WRITE_CODE_SPEC.md`。

**`--run-pending` 警告**：會依檔名**一次跑完** `tasks/pending/` 內**所有** JSON。若只想跑 TAGS-001，請先暫移其他 pending、或改用 Cursor／本機手動實作，勿盲目全跑。

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
