#!/usr/bin/env bash
# 從專案根目錄執行 Lobster Squad watchdog_router.py
# 用法：見 lobster-workspace/README.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 預設：本機 Synology Drive（M4）上的 v4.2；可覆寫 LOBSTER_WATCHDOG
DEFAULT_WATCHDOG="${HOME}/Library/CloudStorage/SynologyDrive-M4/AI/lobster-squad-v4.2/watchdog_router.py"
ALT_V41="${HOME}/lobster-squad-v4.1/watchdog_router.py"

if [[ -n "${LOBSTER_WATCHDOG:-}" ]]; then
  WATCHDOG="$LOBSTER_WATCHDOG"
elif [[ -f "$DEFAULT_WATCHDOG" ]]; then
  WATCHDOG="$DEFAULT_WATCHDOG"
elif [[ -f "$ALT_V41" ]]; then
  WATCHDOG="$ALT_V41"
else
  echo "找不到 watchdog_router.py。"
  echo "請設定："
  echo "  export LOBSTER_WATCHDOG=/path/to/lobster-squad-v4.2/watchdog_router.py"
  echo "然後再執行本腳本。"
  exit 1
fi

cd "$REPO_ROOT"
exec python3 "$WATCHDOG" --workspace "$REPO_ROOT/lobster-workspace" "$@"
