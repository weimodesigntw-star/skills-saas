# Lobster Watchdog：`write_code` 擴充規格

> 一次性投資，實作後 S1～S6 及所有「依 spec 產碼」的任務都可自動跑。

---

## 一、運作流程

```
watchdog 讀 task.json
  ↓
讀取 spec_file（相對於 workspace，例如 ../docs/ERP_S1_APP_SPEC.md）
  ↓
呼叫 Claude API（Anthropic）
  ↓
Claude 產生程式碼 + 檔案路徑
  ↓
watchdog 解析回應，寫入檔案到專案目錄
  ↓
（可選）執行 npm run build 驗證
  ↓
build 成功 → 任務移至 done / 失敗 → 移至 failed（含 error log）
```

---

## 二、Task JSON 格式（`write_code` 型別）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | string | ✅ | 任務 ID，如 S1-APP-001 |
| title | string | ✅ | 任務標題 |
| type | string | ✅ | 固定 `"write_code"` |
| assignee | string | — | 負責人 |
| spec_file | string | ✅ | 規格檔路徑，相對於 **workspace 目錄**，如 `../docs/ERP_S1_APP_SPEC.md`（指向專案內的 docs） |
| project_dir | string | — | 寫入檔案的根目錄，相對於 **workspace 目錄**，預設 `"../"`（即專案根） |
| build_check | boolean | — | 是否在寫入後執行 `npm run build`，預設 `true` |
| acceptance_criteria | string[] | — | 驗收條件（僅供記錄） |

**範例：**

```json
{
  "id": "S1-APP-001",
  "title": "S1 應用層：廠商管理 + 商品/會員表單補欄",
  "type": "write_code",
  "assignee": "tangyuan",
  "spec_file": "../docs/ERP_S1_APP_SPEC.md",
  "project_dir": "../",
  "build_check": true,
  "acceptance_criteria": [
    "app/actions/vendors.ts 存在",
    "app/actions/depots.ts 存在",
    "app/dashboard/vendors/page.tsx 存在",
    "npm run build 通過"
  ]
}
```

**路徑說明：**

- 執行時：`python3 watchdog_router.py --workspace /path/to/skills/lobster-workspace`
- `workspace_root` = `/path/to/skills/lobster-workspace`
- `spec_file` 相對於 workspace → 讀取路徑 = `os.path.join(workspace_root, spec_file)` = `.../lobster-workspace/../docs/ERP_S1_APP_SPEC.md` = `/path/to/skills/docs/ERP_S1_APP_SPEC.md`
- `project_dir` = `"../"` → 寫入檔案的根目錄 = `os.path.join(workspace_root, project_dir)` = `/path/to/skills`

---

## 三、`watchdog_router.py` 新增內容

### 3.1 依賴

```bash
pip install anthropic
```

### 3.2 環境變數

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

可選：在 workspace 的 `config.json` 中增加（印出時須遮罩）：

```json
{
  "anthropic": {
    "api_key": ""
  }
}
```

若 `config.json` 有 `anthropic.api_key` 則優先使用，否則使用環境變數 `ANTHROPIC_API_KEY`。

### 3.3 新增函數：`execute_write_code_task`

```python
import os
import re
import subprocess

def execute_write_code_task(task: dict, cfg: dict, workspace_root: str) -> dict:
    """
    處理 type=write_code 的任務。
    1. 讀取 spec_file
    2. 呼叫 Claude API 產生程式碼
    3. 解析回應並寫入檔案
    4. 選擇性執行 build check

    workspace_root: 傳入 --workspace 的路徑（即 lobster-workspace 目錄）
    """
    spec_file = task.get("spec_file")
    if not spec_file:
        return {"success": False, "error": "write_code 任務缺少 spec_file"}

    project_dir = task.get("project_dir", "../")
    build_check = task.get("build_check", True)

    # 專案根目錄 = workspace 的上一層 + project_dir（通常 "../" 即專案根）
    project_root = os.path.abspath(os.path.join(workspace_root, project_dir))

    # Step 1: 讀取 spec 檔案（路徑相對於 workspace）
    spec_path = os.path.abspath(os.path.join(workspace_root, spec_file))
    if not os.path.exists(spec_path):
        return {"success": False, "error": f"找不到 spec 檔案：{spec_path}"}

    with open(spec_path, "r", encoding="utf-8") as f:
        spec_content = f.read()

    print(f"  讀取規格：{spec_file}（{len(spec_content)} 字）")

    # Step 2: 呼叫 Claude API
    api_key = (cfg.get("anthropic") or {}).get("api_key") or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {"success": False, "error": "未設定 ANTHROPIC_API_KEY 或 config.anthropic.api_key"}

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    prompt = f"""你是一位資深 Next.js 全端工程師。
請依照以下規格，產生所有需要的程式碼檔案。

專案技術棧：Next.js 14 App Router、TypeScript、Tailwind CSS、Supabase、React Hook Form + Zod、Shadcn UI

規格文件：
{spec_content}

請輸出每一個需要建立或修改的檔案，格式如下（嚴格遵守）：

=== FILE: 相對於專案根目錄的檔案路徑 ===
（完整檔案內容）
=== END ===

每個檔案都用 === FILE: path === 和 === END === 包住。
只輸出程式碼，不要額外解釋。"""

    print(f"  呼叫 Claude API...")
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}]
    )

    response_text = message.content[0].text
    print(f"  API 回應：{len(response_text)} 字")

    # Step 3: 解析並寫入檔案
    files_written = []
    errors = []

    pattern = r'=== FILE:\s*(.+?)\s*===\s*\n(.*?)\n=== END ==='
    matches = re.findall(pattern, response_text, re.DOTALL)

    if not matches:
        return {
            "success": False,
            "error": "Claude 回應中找不到任何 === FILE: ... === 區塊",
            "raw_preview": response_text[:800] if response_text else ""
        }

    for file_path, file_content in matches:
        file_path = file_path.strip()
        if not file_path:
            continue
        full_path = os.path.join(project_root, file_path)
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(file_content.strip() + "\n")
            files_written.append(file_path)
            print(f"  ✅ 寫入：{file_path}")
        except Exception as e:
            errors.append(f"{file_path}: {e}")
            print(f"  ❌ 寫入失敗：{file_path} → {e}")

    if errors:
        return {
            "success": False,
            "error": "部分檔案寫入失敗",
            "errors": errors,
            "files_written": files_written
        }

    # Step 4: Build check
    build_result = None
    if build_check:
        print(f"  執行 npm run build...")
        try:
            result = subprocess.run(
                ["npm", "run", "build"],
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=300
            )
            build_result = {
                "success": result.returncode == 0,
                "stdout": (result.stdout or "")[-2000:],
                "stderr": (result.stderr or "")[-2000:]
            }
            if build_result["success"]:
                print(f"  ✅ Build 成功")
            else:
                print(f"  ❌ Build 失敗")
                return {
                    "success": False,
                    "error": "Build 失敗",
                    "files_written": files_written,
                    "build": build_result
                }
        except subprocess.TimeoutExpired:
            build_result = {"success": False, "error": "build timeout"}
            return {"success": False, "error": "Build 逾時", "files_written": files_written, "build": build_result}
        except Exception as e:
            build_result = {"success": False, "error": str(e)}
            return {"success": False, "error": f"Build 執行異常：{e}", "files_written": files_written, "build": build_result}

    return {
        "success": True,
        "files_written": files_written,
        "build": build_result
    }
```

### 3.4 `process_task` 分派更新

在既有 `process_task(task, cfg)` 中增加對 `write_code` 的分派，並傳入 `workspace_root`（由主流程在解析 `--workspace` 後取得）：

```python
def process_task(task: dict, cfg: dict, workspace_root: str) -> dict:
    task_type = task.get("type")

    if task_type == "run_migration":
        return execute_migration_task(task, cfg)

    if task_type == "write_code":
        return execute_write_code_task(task, cfg, workspace_root)

    return {"success": False, "error": f"未知或未實作 task_type: '{task_type}'"}
```

主流程呼叫 `process_task` 時須傳入 `workspace_root`（即 `--workspace` 的絕對路徑）。

### 3.5 任務結果寫回 task JSON

與 `run_migration` 一致：成功時將 `result` 寫入 task，並移動到 `tasks/done/`；失敗時寫入 `result`（含 `error`、必要時 `build`、`files_written`），並移動到 `tasks/failed/`。

---

## 四、Claude 模型與 token

- 建議模型：`claude-sonnet-4-20250514` 或 `claude-opus-4-5`（依預算與回應長度選擇）。
- `max_tokens` 建議 ≥ 8192，若規格較大可提高。
- 規格檔過大時可考慮只傳前 N 字或分段，避免超出 context。

---

## 五、實作步驟（小龍蝦 / 維護者）

```bash
# 1. 安裝 anthropic SDK
pip install anthropic

# 2. 修改 watchdog_router.py
#    - 加入 execute_write_code_task（見上方）
#    - process_task 增加 write_code 分派並傳入 workspace_root

# 3. 設定 API Key
export ANTHROPIC_API_KEY="sk-ant-..."

# 4. 將 S1-APP-001 從 failed 移回 pending（在 skills 專案下）
mv lobster-workspace/tasks/failed/S1-APP-001.json lobster-workspace/tasks/pending/

# 5. 執行
cd /path/to/skills
python3 /path/to/lobster-squad-v4.2/watchdog_router.py \
  --workspace ./lobster-workspace \
  --run-pending
```

---

## 六、預期輸出範例

```
共 1 個待執行任務（依檔名排序）

[S1-APP-001] type=write_code
  讀取規格：docs/ERP_S1_APP_SPEC.md（XXXX 字）
  呼叫 Claude API...
  API 回應：XXXX 字
  ✅ 寫入：app/actions/depots.ts
  ✅ 寫入：app/actions/vendors.ts
  ✅ 寫入：lib/schemas/vendor.ts
  ✅ 寫入：app/dashboard/vendors/page.tsx
  ✅ 寫入：app/dashboard/vendors/VendorsClient.tsx
  ✅ 寫入：components/vendors/VendorDialog.tsx
  ...
  執行 npm run build...
  ✅ Build 成功
  → 已移至 tasks/done/
```

---

## 七、後續 S2～S6

每個 Sprint 的應用層任務皆可採用相同格式：

- `type`: `"write_code"`
- `spec_file`: 相對於 workspace 的規格檔（如 `../docs/ERP_S2_SPEC.md`）
- `project_dir`: `"../"`
- `build_check`: `true`

完成本擴充後，S1～S6 均可依規格自動產碼並驗證 build。
