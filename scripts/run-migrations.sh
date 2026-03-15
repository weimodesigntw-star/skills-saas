#!/usr/bin/env bash
# 依序執行 migrations 016～024（需設定 DATABASE_URL）
# 使用方式：export DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'
#          ./scripts/run-migrations.sh
# 或：DATABASE_URL='...' ./scripts/run-migrations.sh

set -e
cd "$(dirname "$0")/.."

if [ -z "$DATABASE_URL" ]; then
  echo "請先設定 DATABASE_URL（Supabase Dashboard → Settings → Database → Connection string URI）"
  exit 1
fi

MIGRATIONS="
016_invoice_sequence_unique_and_rpc.sql
017_orders_invoice_number.sql
018_stock_adjustments.sql
019_adjust_stock_rpc.sql
020_dashboard_rpcs.sql
021_invoices_ecpay_fields.sql
022_members.sql
023_create_pos_order_customer.sql
024_orders_member_id.sql
"

for f in $MIGRATIONS; do
  path="supabase/migrations/$f"
  if [ ! -f "$path" ]; then
    echo "跳過（找不到）: $path"
    continue
  fi
  echo "執行: $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$path" || { echo "失敗: $f"; exit 1; }
done

echo "全部 migrations 執行完成。"
