CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id     UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  product_code    TEXT,
  product_name    TEXT NOT NULL,
  unit_name       TEXT,
  qty             NUMERIC NOT NULL DEFAULT 1,
  unit_price      NUMERIC NOT NULL DEFAULT 0,
  subtotal        NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access via purchase" ON purchase_order_items;
CREATE POLICY "owner access via purchase" ON purchase_order_items
  USING (EXISTS (
    SELECT 1 FROM purchase_orders po
    WHERE po.id = purchase_order_items.purchase_id
    AND po.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_order_items(purchase_id);
