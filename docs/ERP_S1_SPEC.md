# 方案 C Sprint 1 可執行規格

> 目標：DB 補齊 ERP 欄位 + 廠商管理 CRUD，完成後可一次匯入 ERP 資料。

---

## 一、範圍與產出

| 產出 | 說明 |
|------|------|
| **Migrations 025～028** | 已建立於 `supabase/migrations/`，執行順序不可顛倒 |
| **廠商管理** | 新模組：列表、新增、編輯、刪除（CRUD） |
| **商品表單** | 既有商品新增/編輯頁補欄位：商品代碼、批發價、採購單價、廠商、倉庫 |
| **會員表單** | 既有會員新增/編輯補欄位：客戶代碼、統一編號、幣別、稅別、稅率、預付款、客戶類別 |
| **Sidebar** | 新增「廠商管理」導航項 |

---

## 二、Migrations 執行順序

依序執行（已存在於專案）：

| 順序 | 檔案 | 說明 |
|------|------|------|
| 1 | `025_vendors.sql` | 廠商主檔 |
| 2 | `026_depots.sql` | 倉庫主檔 |
| 3 | `027_products_erp_fields.sql` | 商品補欄位（依賴 025、026） |
| 4 | `028_members_erp_fields.sql` | 會員補欄位 |

執行方式：Supabase Dashboard SQL Editor 依序貼上執行，或 `supabase db push`（已 link 時）。

---

## 三、廠商管理 CRUD

### 3.1 資料結構（對應 `vendors` 表）

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| id | UUID | 自動 | PK |
| user_id | UUID | 是 | auth.users(id) |
| vendor_code | TEXT | 否 | 廠商代碼 |
| vendor_name | TEXT | 是 | 廠商名稱 |
| vendor_cat | TEXT | 否 | 廠商類別 |
| uniform_num | TEXT | 否 | 統一編號 |
| currency | TEXT | 否 | 預設「台幣」 |
| tax_type | TEXT | 否 | 稅別 |
| taxrate | NUMERIC | 否 | 預設 0.05 |
| contact | TEXT | 否 | 聯絡人 |
| phone | TEXT | 否 | 電話 |
| email | TEXT | 否 | Email |
| note | TEXT | 否 | 備註 |
| created_at / updated_at | TIMESTAMPTZ | 自動 | |

### 3.2 後端

- **`app/actions/vendors.ts`**（新建）
  - `getVendors()`：列表（依 user_id RLS）
  - `getVendorById(id)`：單筆
  - `createVendor(data)`：新增
  - `updateVendor(id, data)`：更新
  - `deleteVendor(id)`：刪除（若有 products.vendor_id 引用可 SET NULL 或禁止刪除，規格選：禁止刪除有商品引用的廠商，或改為 SET NULL）

### 3.3 前端

- **路由**
  - `app/dashboard/vendors/page.tsx`：廠商列表（表格：代碼、名稱、類別、聯絡人、電話、操作）
  - `app/dashboard/vendors/new/page.tsx`：新增廠商（表單）
  - `app/dashboard/vendors/[id]/page.tsx`：編輯廠商（表單 + 返回列表）

- **元件**
  - 可沿用會員模組模式：`VendorsClient.tsx`（列表 + 搜尋）、`VendorDialog.tsx` 或 獨立 new/[id] 表單頁。
  - 表單欄位：廠商代碼、廠商名稱、廠商類別、統一編號、幣別、稅別、稅率、聯絡人、電話、Email、備註。

### 3.4 Sidebar

- 在 `components/layout/Sidebar.tsx` 的 `navItems` 中新增一項：
  - `{ href: '/dashboard/vendors', label: '廠商管理', icon: Truck }`（或 Building2）
  - 建議放在「商品」附近（例如「商品」與「規格」之間）。

---

## 四、商品表單補欄位

### 4.1 新增欄位（對應 migration 027）

| 欄位 | 表單標籤 | 型別 | 說明 |
|------|----------|------|------|
| product_code | 商品代碼 | text | 選填 |
| whole_sell_price | 批發價 | number | 數字，預設 0 |
| purchase_price | 採購單價 | number | 數字，預設 0 |
| vendor_id | 廠商 | select | 選單來自 `getVendors()`，選填 |
| depot_id | 倉庫 | select | 選單來自 `getDepots()`，選填 |

### 4.2 修改檔案

- **`app/dashboard/products/new/page.tsx`**：表單增加上述五個欄位；submit 時一併寫入。
- **`app/dashboard/products/[id]/page.tsx`**：編輯表單增加上述五個欄位；load 時帶出，submit 時一併更新。
- **`app/actions/products.ts`**：`createProduct` / `updateProduct` 的參數與 Supabase insert/update 增加對應欄位。
- **`lib/schemas/product.ts`**（若存在）或表單 schema：增加 product_code, whole_sell_price, purchase_price, vendor_id, depot_id 的驗證（選填、數字 ≥ 0）。

### 4.3 倉庫 API

- **`app/actions/depots.ts`**（新建，若尚未有）
  - `getDepots()`：列表（依 user_id RLS），供商品表單「倉庫」下拉使用。

---

## 五、會員表單補欄位

### 5.1 新增欄位（對應 migration 028）

| 欄位 | 表單標籤 | 型別 | 說明 |
|------|----------|------|------|
| client_code | 客戶代碼 | text | 選填 |
| uniform_num | 統一編號 | text | 選填 |
| currency | 幣別 | text/select | 預設「台幣」 |
| tax_type | 稅別 | text/select | 選填 |
| taxrate | 稅率 | number | 預設 0.05 |
| prepaid | 預付款 | number | 預設 0 |
| client_cat | 客戶類別 | text | 選填 |

### 5.2 修改檔案

- **會員新增/編輯表單**：`components/members/MemberDialog.tsx` 或 `app/dashboard/members/[id]/` 表單頁，增加上述欄位。
- **`app/actions/customer-members.ts`**：create / update 時讀寫 client_code, uniform_num, currency, tax_type, taxrate, prepaid, client_cat。
- Schema（若有）：在會員 schema 中增加對應欄位與驗證。

---

## 六、驗收標準

- [ ] 依序執行 025、026、027、028 無錯誤。
- [ ] 廠商管理：可新增、編輯、刪除廠商；列表正確顯示。
- [ ] 商品新增/編輯：可填寫並儲存 商品代碼、批發價、採購單價、廠商、倉庫。
- [ ] 會員新增/編輯：可填寫並儲存 客戶代碼、統一編號、幣別、稅別、稅率、預付款、客戶類別。
- [ ] Sidebar 有「廠商管理」且可進入 `/dashboard/vendors`。
- [ ] 若有商品引用某廠商，刪除廠商時採「禁止刪除」或「將該商品的廠商清空」擇一實作並符合預期。

---

## 七、後續 Sprint 依賴

- **S2 客戶訂單**：會用到 members（客戶）、products（品項）；S1 補齊欄位後即可開始。
- **S3 出貨單**：會用到 depots、庫存；S1 已有 depots 與商品 depot_id。
- **S5 採購單**：會用到 vendors、depots、products；S1 完成後即可設計採購單主檔與明細。

S1 完成後，即可進行 **ERP 資料一次性匯入**（廠商、倉庫、商品、會員補欄位後再匯入訂單/出貨/採購）。
