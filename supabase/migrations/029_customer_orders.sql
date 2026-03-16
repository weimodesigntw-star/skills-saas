CREATE TABLE customer_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id),
  order_code       TEXT NOT NULL,
  advance_date     DATE,
  undertaker       TEXT,
  member_id        UUID REFERENCES members(id),
  currency         TEXT DEFAULT '台幣',
  tax_type         TEXT DEFAULT '稅內含',
  taxrate          NUMERIC DEFAULT 0.05,
  subtotal         NUMERIC DEFAULT 0,
  tax_amount       NUMERIC DEFAULT 0,
  total            NUMERIC DEFAULT 0,
  sales_channel    TEXT DEFAULT '零售',
  note             TEXT,
  status           TEXT DEFAULT 'pending',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON customer_orders USING (user_id = auth.uid());
CREATE INDEX idx_customer_orders_user_id ON customer_orders(user_id);
CREATE INDEX idx_customer_orders_member_id ON customer_orders(member_id);
CREATE TRIGGER customer_orders_updated_at
  BEFORE UPDATE ON customer_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
