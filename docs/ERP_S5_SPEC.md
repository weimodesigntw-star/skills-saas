# S5｜採購單 + 應付沖帳 — 可執行規格

## 核心概念

廠商 → 採購單（進貨）→ 庫存增加。應付沖帳：對多張採購單一次付款給廠商。

## Migrations

- **036** purchase_orders 主檔
- **037** purchase_order_items 明細
- **038** payable_writeoffs + payable_writeoff_items（應付沖帳表）+ 全部 RPC（generate_purchase_code, create_purchase_order, generate_payable_code, execute_payable_writeoff）

執行順序：036 → 037 → 038

## Schema

- lib/schemas/purchase-order.ts
- lib/schemas/payable-writeoff.ts

## Actions

- app/actions/purchase-orders.ts：fetchPurchaseOrders, fetchPurchaseOrderById, createPurchaseOrder, voidPurchaseOrder, payPurchaseOrder
- app/actions/payable-writeoffs.ts：fetchPayableWriteoffs, fetchPayableWriteoffById, fetchPendingPurchasesByVendor, createPayableWriteoff

## 頁面

- /dashboard/purchases 列表、new、[id]；PayPurchaseDialog
- /dashboard/payables 列表、new、[id]；PayableWriteoffForm
- Sidebar：採購管理、應付沖帳

## 驗收

採購單列表/新增/詳情、進貨後庫存增加、付款 Dialog、作廢回補庫存；應付沖帳列表/新增、沖帳後採購單未付扣減；build 通過。
