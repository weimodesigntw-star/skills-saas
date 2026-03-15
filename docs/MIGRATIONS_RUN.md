# Migrations 驗收 — 請依序執行

專案若尚未 `supabase link`，無法用 CLI 直接 `db push`。請擇一方式執行。

---

## 方式一：用 Supabase CLI（已 link 時）

```bash
cd /path/to/skills
npx supabase link    # 首次需設定 project ref
npx supabase db push
```

---

## 方式二：Supabase Dashboard 手動執行（未 link 時）

1. 開啟 **Supabase Dashboard** → 選擇專案 → **SQL Editor**
2. 依序建立 **New query**，貼上下列檔案內容並 **Run**（順序勿顛倒）

| 順序 | 檔案 | 用途 |
|------|------|------|
| 1 | `supabase/migrations/016_invoice_sequence_unique_and_rpc.sql` | 字軌 unique + RPC |
| 2 | `supabase/migrations/017_orders_invoice_number.sql` | orders.invoice_number |
| 3 | `supabase/migrations/018_stock_adjustments.sql` | stock_adjustments 表 |
| 4 | `supabase/migrations/019_adjust_stock_rpc.sql` | adjust_stock RPC |
| 5 | `supabase/migrations/020_dashboard_rpcs.sql` | get_daily_revenue、get_top_products |
| 6 | `supabase/migrations/021_invoices_ecpay_fields.sql` | invoices ECPay 欄位 |
| 7 | `supabase/migrations/022_members.sql` | members 表 |
| 8 | `supabase/migrations/023_create_pos_order_customer.sql` | create_pos_order 擴充顧客欄位 |
| 9 | `supabase/migrations/024_orders_member_id.sql` | 選做，orders.member_id |
| 10～13 | **方案 C S1**：`025_vendors.sql` → `026_depots.sql` → `027_products_erp_fields.sql` → `028_members_erp_fields.sql` | 廠商、倉庫、商品/會員 ERP 欄位 |

3. 每支執行後確認無錯誤再執行下一支。
4. **024 為選做**：若暫不做會員消費紀錄，可略過；會員詳情頁會顯示「尚無消費紀錄」。

---

## 方式三：本機用 DATABASE_URL + 腳本一次執行

若已安裝 `psql` 且能取得資料庫連線網址，可一次跑完 016～024：

1. 在 **Supabase Dashboard** → **Settings** → **Database** 複製 **Connection string**（URI 格式）。
2. 在本機終端機設定並執行：

```bash
cd /path/to/skills
export DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres'
./scripts/run-migrations.sh
```

或單行：`DATABASE_URL='...' ./scripts/run-migrations.sh`  
任一 migration 失敗會中斷並顯示「失敗: 檔名」。

---

## 驗收確認

執行完成後可簡單確認：

- **Table Editor**：存在 `members`、`stock_adjustments`；`invoices` 有 `ecpay_invoice_number`、`ecpay_random_number`；`orders` 若有跑 024 則有 `member_id`。
- **Dashboard 總覽**：重新整理 `/dashboard`，圖表與指標卡有資料（或空資料無報錯）。
- **會員管理**：`/dashboard/members` 可開列表、新增會員、進入詳情頁無 500。

完成後即可視為 migrations 驗收通過。
