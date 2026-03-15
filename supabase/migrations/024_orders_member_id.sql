-- P2-3 選做：訂單關聯會員（消費紀錄用）
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_member_id ON orders(member_id);
