-- =============================================================================
-- 一次性：將所有 EasyStore 同步的客戶訂單標記為「已全額收款」
-- （amt_recd = total，應收餘額在報表上為 0）
--
-- 前提：已執行 migration 047（customer_orders.amt_recd）
-- 識別：easystore_order_id IS NOT NULL（來自 EasyStore 同步）
--
-- 執行：Supabase SQL Editor → 以具備權限角色執行整段
-- 注意：不會寫入 receivable_writeoffs 歷史，僅修正餘額欄位；若需審計請另補沖帳單
-- =============================================================================

-- 預覽將影響筆數（可選）
-- SELECT COUNT(*) FROM customer_orders
-- WHERE easystore_order_id IS NOT NULL
--   AND COALESCE(status, '') <> 'cancelled';

UPDATE customer_orders
SET
  amt_recd = COALESCE(total, 0),
  updated_at = NOW()
WHERE easystore_order_id IS NOT NULL
  AND COALESCE(status, '') <> 'cancelled';

-- 若只想單一租戶，請加上 AND user_id = '...' 再執行 UPDATE

-- 驗收（可選）
-- SELECT order_code, total, amt_recd, (COALESCE(total,0) - COALESCE(amt_recd,0)) AS outstanding
-- FROM customer_orders
-- WHERE easystore_order_id IS NOT NULL
-- LIMIT 20;
