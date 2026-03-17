-- EasyStore 整合設定（OAuth token / webhook mapping）

CREATE TABLE IF NOT EXISTS easystore_integrations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop text UNIQUE NOT NULL,
  access_token text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE easystore_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access" ON easystore_integrations;
CREATE POLICY "owner access" ON easystore_integrations
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_easystore_integrations_user_id ON easystore_integrations(user_id);

-- members 和 orders 加 easystore_id 欄位
ALTER TABLE members ADD COLUMN IF NOT EXISTS easystore_customer_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_easystore_customer_id
  ON members(easystore_customer_id) WHERE easystore_customer_id IS NOT NULL AND easystore_customer_id != '';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS easystore_order_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_easystore_order_id
  ON orders(easystore_order_id) WHERE easystore_order_id IS NOT NULL AND easystore_order_id != '';

