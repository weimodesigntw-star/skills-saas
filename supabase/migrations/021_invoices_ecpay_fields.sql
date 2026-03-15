-- P2-1：發票表補 ECPay 回傳欄位（開立後寫入 ECPay 發票號碼、隨機碼）
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS ecpay_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS ecpay_random_number  TEXT;
