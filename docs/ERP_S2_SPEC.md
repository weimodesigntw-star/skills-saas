# S2｜客戶訂單 — 可執行規格

## Migrations（029～031）

- **029_customer_orders.sql**：客戶訂單主檔、RLS、updated_at trigger、索引
- **030_customer_order_items.sql**：訂單明細、RLS（via order）、ON DELETE CASCADE
- **031_customer_order_code_rpc.sql**：自動產生訂單號 BA201-YYYYMMDD-XXXX

## Zod Schema

- **lib/schemas/customer-order.ts**：`orderItemSchema`、`customerOrderSchema`、`CustomerOrderFormValues`、`OrderItemFormValues`

## Server Actions

- **app/actions/customer-orders.ts**：fetchCustomerOrders、fetchCustomerOrderById、createCustomerOrder、updateCustomerOrder、deleteCustomerOrder、calcTotals / calcItemSubtotal

## 頁面結構

```
app/dashboard/orders/
  page.tsx                ← 訂單列表（Server Component）
  OrdersClient.tsx        ← 列表 + 篩選（Client Component）
  new/page.tsx            ← 新增訂單頁
  [id]/page.tsx           ← 訂單詳情頁
  [id]/edit/page.tsx      ← 編輯訂單頁
components/orders/
  OrderForm.tsx           ← 新增/編輯共用表單
  OrderItemsTable.tsx     ← 明細子表格（可新增/刪除列）
  ProductPickerDialog.tsx ← 從商品清單選品
```

## 頁面規格

### 訂單列表（/dashboard/orders）

- 篩選：狀態下拉、日期起、日期訖、搜尋訂單號、查詢、+ 新增訂單
- 表格：訂單號碼 | 預交日期 | 客戶名稱 | 銷售方式 | 原幣合計 | 狀態 Badge | 操作（查看/編輯/刪除）
- 狀態 Badge：pending → 待出貨（黃）、shipped → 已出貨（綠）、cancelled → 已取消（灰）
- 分頁：每頁 20 筆

### 新增/編輯訂單（OrderForm）

- 訂單主檔：訂單號碼（自動產生唯讀）、預交日期、客戶（搜尋選取 member）、承辦人、幣別、稅別、稅率、銷售方式、備註
- 明細表格：# | 品名 | 規格 | 單位 | 數量 | 單價 | 折數% | 小計 | 刪除；+ 新增明細；選品開 ProductPickerDialog
- 統計：小計、稅額、合計

### 訂單詳情（/dashboard/orders/[id]）

- 顯示訂單號碼、預交日期、客戶、狀態、銷售方式、備註、明細表、小計/稅額/合計、編輯/刪除、返回列表

### ProductPickerDialog

- 搜尋商品名稱/代碼，表格：商品代碼 | 商品名稱 | 規格 | 零售價 | 批發價 | 選取
- 選取後帶入：品名、單位、單價（依銷售方式用零售價或批發價）、product_id、product_code

## Sidebar

- 新增「客戶訂單」連結，href `/dashboard/orders`，icon ClipboardList，放在廠商管理下方。

## 驗收清單

- /dashboard/orders 訂單列表正常載入
- 篩選（狀態、日期）有效
- 點「新增訂單」進入表單頁
- 可從 ProductPickerDialog 選品，帶入明細
- 可手動輸入明細
- 小計/稅額/合計自動計算
- 儲存後出現在列表
- 訂單詳情頁資料正確
- 編輯後金額更新
- 刪除後從列表消失
- Sidebar 有「客戶訂單」連結
- npm run build 通過
