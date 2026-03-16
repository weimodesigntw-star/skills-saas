CREATE TABLE IF NOT EXISTS customer_order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_id       UUID REFERENCES products(id),
  product_code     TEXT,
  product_name     TEXT NOT NULL,
  unit_name        TEXT,
  qty              NUMERIC NOT NULL DEFAULT 1,
  shipped_qty      NUMERIC DEFAULT 0,
  unit_price       NUMERIC NOT NULL DEFAULT 0,
  discount_pct     NUMERIC DEFAULT 100,
  subtotal         NUMERIC DEFAULT 0,
  note             TEXT,
  cancelled        BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customer_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access via order" ON customer_order_items;
CREATE POLICY "owner access via order" ON customer_order_items
  USING (EXISTS (
    SELECT 1 FROM customer_orders
    WHERE customer_orders.id = customer_order_items.order_id
    AND customer_orders.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON customer_order_items(order_id);
