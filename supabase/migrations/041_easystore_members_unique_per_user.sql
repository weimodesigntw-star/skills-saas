-- EasyStore customers 同步：多租戶唯一鍵調整
-- 舊：members.easystore_customer_id 全域唯一（不同 user 會衝突）
-- 新：同一 user 內唯一（user_id, easystore_customer_id）

DROP INDEX IF EXISTS idx_members_easystore_customer_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_user_easystore_customer_id
  ON members(user_id, easystore_customer_id)
  WHERE easystore_customer_id IS NOT NULL AND easystore_customer_id != '';

