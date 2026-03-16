CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  receive_code  TEXT NOT NULL,
  receive_day   DATE,
  undertaker    TEXT,
  vendor_id     UUID REFERENCES vendors(id),
  vendor_name   TEXT,
  depot_id      UUID REFERENCES depots(id),
  currency      TEXT DEFAULT '台幣',
  tax_type      TEXT DEFAULT '稅內含',
  taxrate       NUMERIC DEFAULT 0.05,
  subtotal      NUMERIC DEFAULT 0,
  tax_amount    NUMERIC DEFAULT 0,
  total         NUMERIC DEFAULT 0,
  amt_paid      NUMERIC DEFAULT 0,
  amt_unpaid    NUMERIC DEFAULT 0,
  note          TEXT,
  status        TEXT DEFAULT 'valid',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access" ON purchase_orders;
CREATE POLICY "owner access" ON purchase_orders USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
DROP TRIGGER IF EXISTS purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
