# P1-4｜庫存頁面 — 可執行規格（小龍蝦對照用）

## 前置：確認 migration 是否已執行

在 **Supabase Dashboard → Table Editor** 確認：

- **`stock_adjustments` 表不存在** → 執行 `018_stock_adjustments.sql`、`019_adjust_stock_rpc.sql`
- **已存在** → 跳過 migration，直接使用

---

## 已實作內容

### Migration

| 檔案 | 說明 |
|------|------|
| `supabase/migrations/018_stock_adjustments.sql` | 建立 `stock_adjustments` 表，`user_id` 參考 `profiles(id)`，`type` 限定 `restock` / `loss` / `manual` |
| `supabase/migrations/019_adjust_stock_rpc.sql` | 建立 RPC `adjust_stock(p_product_id, p_user_id, p_type, p_qty, p_note)`，原子更新 `products.stock` 並寫入 `stock_adjustments` |

### Server Actions（`app/actions/inventory.ts`）

| Action | 參數 / 回傳 |
|--------|-------------|
| `fetchInventory(params)` | `categoryId`, `lowStockOnly`, `search`, `page`, `pageSize` → `{ items, total, page, pageSize }`，每筆含 `id`, `name`, `category_name`, `barcode`, `stock`, `is_low_stock` |
| `adjustStock(data)` | `productId`, `type`, `qty`, `note?` → 呼叫 RPC `adjust_stock`，回傳 `{ qtyAfter }` 或 `{ error }` |
| `fetchStockHistory(params)` | `productId?`, `page`, `pageSize` → `{ records, total, page, pageSize }`，每筆含 `id`, `created_at`, `product_name`, `type`, `qty_change`, `qty_after`, `note` |

### 頁面 `/dashboard/pos/inventory`

- **上半部**：庫存列表（搜尋、分類下拉、□ 只顯示低庫存、查詢）、表格（商品名稱、分類、條碼、目前庫存、狀態、操作）、分頁（每頁 20 筆）、低庫存為紅字 + 警示 icon
- **調整 Dialog**：目前庫存、調整類型（補貨 / 盤虧 / 手動設定）、數量、備註、預覽「調整後庫存將為 X」、確認調整
- **下半部**：調整歷史表格（時間、商品、類型、變動量、調整後、備註）、分頁

### Sidebar

- 已新增 **庫存管理** → `/dashboard/pos/inventory`（icon: Warehouse）

---

## 注意事項

| 項目 | 說明 |
|------|------|
| Migration 順序 | 先 018 建表，再 019 建 RPC |
| 低庫存閾值 | 目前硬編為 5（`LOW_STOCK_THRESHOLD`），與 `products.low_stock_threshold` 並用，可改為讀取欄位 |
| RPC 防負庫存 | `loss` 使用 `GREATEST(v_current - p_qty, 0)` |
| 本專案 user 關聯 | `user_id` 一律參考 `profiles(id)`，未使用 `auth.users(id)` |

---

## 執行 migration（若表不存在）

```bash
npx supabase db push
```

或在 Supabase SQL Editor 依序執行 `018_stock_adjustments.sql`、`019_adjust_stock_rpc.sql` 內容。
