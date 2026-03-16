# S6｜報表匯出 — 可執行規格

## 核心概念

三張核心報表，支援 **Excel 下載**（前端 SheetJS xlsx，無需後端 API、無需新 migration）：

- **出貨明細表**：依日期/客戶篩選，每筆出貨明細（品名、數量、單價、小計）
- **毛利報表**：出貨單價 vs 採購單價，毛利與毛利率
- **應收帳款明細**：每筆出貨單收款狀況（已收/未收）

## 技術方案

- `npm install xlsx`
- Server Actions：`app/actions/reports.ts`（fetchShipmentReport、fetchProfitReport、fetchReceivableReport）
- 頁面：`/dashboard/reports` — Tab 切換三張報表、共用篩選（日期起迄、客戶）、匯出 Excel
- 元件：`components/reports/ExportExcel.tsx`（exportShipmentReport、exportProfitReport、exportReceivableReport）

## 驗收清單

- /dashboard/reports 頁面載入正常
- Sidebar「報表」連結正確（BarChart3）
- Tab 出貨明細表 / 毛利報表 / 應收帳款明細表：篩選後顯示資料
- 匯出 Excel 自動下載 .xlsx，欄位正確、有合計列
- npm run build 通過
