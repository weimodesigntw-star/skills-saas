# S3｜出貨單 — 可執行規格

## Migrations（032～034）

- **032_shipments.sql**：出貨單主檔、RLS、updated_at trigger、索引
- **033_shipment_items.sql**：出貨明細、RLS（via shipment）、ON DELETE CASCADE
- **034_shipment_rpcs.sql**：generate_ship_code、create_shipment_from_order（原子：建出貨單 + 扣庫存 + 更新 shipped_qty）

## Schema

- **lib/schemas/shipment.ts**：shipmentItemSchema、shipmentSchema、receivePaymentSchema

## Server Actions

- **app/actions/shipments.ts**：fetchShipments、fetchShipmentById、createShipmentFromOrder（RPC）、createShipmentManual、receivePayment、voidShipment

## 頁面結構

- app/dashboard/shipments/page.tsx、ShipmentsClient.tsx
- app/dashboard/shipments/new/page.tsx（手動新增）
- app/dashboard/shipments/from-order/[orderId]/page.tsx（從訂單轉出貨）
- app/dashboard/shipments/[id]/page.tsx（出貨單詳情）
- components/shipments/ShipmentForm.tsx、FromOrderShipmentForm.tsx、ReceivePaymentDialog.tsx

## 規格摘要

- 列表：篩選狀態/日期、表格出貨單號/日期/客戶/來源訂單/合計/已收/未收/狀態、操作查看/收款/作廢
- 從訂單轉出貨：來源訂單唯讀、出貨日期/倉庫/備註、明細可調本次出貨量（≤剩餘量）、確認出貨呼叫 RPC
- 收款 Dialog：輸入金額、更新 amt_recd / amt_outstanding
- 訂單詳情（pending）顯示「轉出貨單」按鈕
- Sidebar：「出貨管理」→ /dashboard/shipments，icon Truck

## 驗收清單

- 出貨單列表、Sidebar、訂單詳情轉出貨按鈕、從訂單轉出貨表單與出貨量、出貨後庫存與訂單狀態、出貨單詳情、收款、手動新增、作廢、build 通過
