# S4｜應收沖帳 — 可執行規格

## 核心概念

應收沖帳：把多張出貨單的未收款一次對帳收清。選客戶 → 載入待收出貨單 → 填沖帳金額/折讓/動用預收 → 確認沖帳後出貨單 amt_outstanding 扣減。

## Migration（035）

- **035_receivable_writeoffs.sql**：receivable_writeoffs 主檔、receivable_writeoff_items 明細、RLS、generate_writeoff_code、execute_receivable_writeoff RPC

## Schema

- **lib/schemas/receivable-writeoff.ts**：writeoffItemSchema、receivableWriteoffSchema

## Server Actions

- **app/actions/receivable-writeoffs.ts**：fetchWriteoffs、fetchWriteoffById、fetchPendingShipmentsByMember、createWriteoff（RPC）、deleteWriteoff（僅當日可刪、回補出貨單）

## 頁面結構

- app/dashboard/receivables/page.tsx、ReceivablesClient.tsx
- app/dashboard/receivables/new/page.tsx、WriteoffForm
- app/dashboard/receivables/[id]/page.tsx

## 規格摘要

- 列表：篩選客戶/日期、表格沖帳單號/日期/客戶/應收總額/折讓/實收/備註、查看
- 新增：選客戶 → 查詢待收出貨單 → 勾選、填本次沖帳金額、沖帳日期/折讓/動用預收、實收=應收合計-折讓-動用預收
- 詳情：沖帳單號、日期、客戶、明細表、應收合計/折讓/動用預收/實收
- Sidebar：「應收沖帳」→ /dashboard/receivables，icon Receipt

## 驗收清單

- 列表、Sidebar、新增沖帳選客戶與載入待收、勾選與沖帳金額、實收計算、確認沖帳後出貨單未收扣減、詳情頁、build 通過
