-- ========================================
-- Migration 017: 訂單表增加發票號碼欄位
-- 開立發票後寫入，方便列表/詳情顯示，無需 JOIN invoices
-- ========================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_invoice_number ON orders(invoice_number) WHERE invoice_number IS NOT NULL;
