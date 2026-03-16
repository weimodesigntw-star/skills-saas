# Excel 匯入功能規格（ERP 匯出格式）

## 範圍

匯入 ERP 已匯出的 Excel（如 `織然工作室_ERP資料匯出_2026-03-15.xlsx`），第一優先：

| 工作表   | 匯入目標表   |
|----------|--------------|
| 產品資料 | `products`   |
| 客戶資料 | `members`   |

## 技術方案

1. 使用者上傳 .xlsx → SheetJS 解析（xlsx 已安裝）
2. 前端 Preview 表格（前 5 筆 + 總筆數）
3. 確認匯入 → Server Action 批次 upsert（依 product_code / client_code 去重）
4. 顯示結果：成功 N 筆 / 失敗 M 筆

## 匯入按鈕位置

- 商品管理頁右上角：`[📥 匯入 Excel]` 與 `[+ 新增商品]` 並排
- 會員管理頁右上角：`[📥 匯入 Excel]` 與 `[+ 新增會員]` 並排

## 產品資料匯入欄位（對齊 ERP 匯出）

| ERP Excel 欄位   | Skills DB 欄位   | 備註 |
|------------------|------------------|------|
| 產品代碼         | product_code     | 去重 key，空白則純新增 |
| 產品名稱         | name             | 必填 |
| 規格             | description      | 可與顏色合併 |
| 顏色             | description 附加 | 可併入 description |
| 標準單位         | unit_name        | 需 migration 新增 |
| 產品類別名稱     | category_id      | 依 name 查找或建立分類 |
| 零售價           | price            | |
| 批發價           | whole_sell_price | |
| 採購單價         | purchase_price   | |
| 停用             | is_active        | 0=啟用，1=停用 |

## 客戶資料匯入欄位

| ERP Excel 欄位 | Skills DB 欄位 | 備註 |
|---------------|----------------|------|
| 客戶代碼      | client_code    | 去重 key |
| 客戶名稱      | name           | 必填 |
| 客戶類別      | client_cat     | |
| 統一編號      | uniform_num    | |
| 幣別          | currency       | 預設台幣 |
| 稅別          | tax_type       | |
| 稅率          | taxrate        | |
| Email         | email          | |
| 電話          | phone          | ERP 可能為「電話」欄 |
| 備註          | note           | |
| 停用          | is_active      | 需 migration 新增 |

## 範本標題行（與 ERP 匯出一致）

**產品資料：**  
`產品代碼, 產品名稱, 規格, 顏色, 產品性質, 標準單位, 標準單位換算率, 產品類別名稱, 零售價, 批發價, 採購單價, 停用`

**客戶資料：**  
`客戶代碼, 客戶名稱, 客戶類別, 統一編號, 幣別, 稅別, 稅率, Email, 電話, 縣市, 地區, 生日, 備註, 停用`

## 驗收清單

- 商品管理 / 會員管理頁有「匯入 Excel」按鈕
- 下載範本可取得對應標題的 xlsx
- 上傳後解析成功、顯示 Preview
- 確認匯入後顯示成功/失敗筆數，重複匯入為 upsert 不重複
- npm run build 通過
