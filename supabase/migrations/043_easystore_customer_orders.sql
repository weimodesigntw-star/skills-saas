-- EasyStore orders sync support for customer_orders

-- 訂單主檔加上 Easystore 訂單 ID（每個 user 下唯一）
ALTER TABLE customer_orders
  ADD COLUMN IF NOT EXISTS easystore_order_id text;

-- 明細加上 Easystore line item ID（選填，用來對應 EasyStore line_items）
ALTER TABLE customer_order_items
  ADD COLUMN IF NOT EXISTS easystore_line_item_id text;

-- 為 Easystore 訂單建立唯一約束（配合 ON CONFLICT (user_id, easystore_order_id)）
ALTER TABLE customer_orders
  ADD CONSTRAINT customer_orders_easystore_uid_unique
  UNIQUE (user_id, easystore_order_id);

