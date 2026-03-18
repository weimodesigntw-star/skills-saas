-- Easystore customers sync: ensure ON CONFLICT target exists
-- 將 (user_id, easystore_customer_id) 改為真正的 UNIQUE constraint

-- 刪除舊的（可能是部分索引或舊命名）的 index
DROP INDEX IF EXISTS idx_members_user_easystore_customer_id;
DROP INDEX IF EXISTS members_easystore_customer_id_user_id_idx;

-- 建立完整的 UNIQUE constraint，讓
--   ON CONFLICT (user_id, easystore_customer_id)
-- 可以正確對應到此約束
ALTER TABLE members
  ADD CONSTRAINT members_easystore_uid_unique
  UNIQUE (user_id, easystore_customer_id);

