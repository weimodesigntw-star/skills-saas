CREATE TABLE IF NOT EXISTS shipments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id),
  ship_code             TEXT NOT NULL,
  ship_date             DATE,
  undertaker            TEXT,
  member_id             UUID REFERENCES members(id),
  source_order_code     TEXT,
  source_order_id       UUID REFERENCES customer_orders(id),
  depot_id              UUID REFERENCES depots(id),
  currency              TEXT DEFAULT '台幣',
  tax_type              TEXT DEFAULT '稅內含',
  taxrate               NUMERIC DEFAULT 0.05,
  subtotal              NUMERIC DEFAULT 0,
  tax_amount            NUMERIC DEFAULT 0,
  total                 NUMERIC DEFAULT 0,
  amt_recd              NUMERIC DEFAULT 0,
  amt_outstanding       NUMERIC DEFAULT 0,
  amt_discount          NUMERIC DEFAULT 0,
  note                  TEXT,
  status                TEXT DEFAULT 'valid',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access" ON shipments;
CREATE POLICY "owner access" ON shipments USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_shipments_user_id ON shipments(user_id);
CREATE INDEX IF NOT EXISTS idx_shipments_member_id ON shipments(member_id);
CREATE INDEX IF NOT EXISTS idx_shipments_source_order_id ON shipments(source_order_id);
DROP TRIGGER IF EXISTS shipments_updated_at ON shipments;
CREATE TRIGGER shipments_updated_at
  BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
