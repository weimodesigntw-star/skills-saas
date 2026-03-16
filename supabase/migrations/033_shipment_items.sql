CREATE TABLE IF NOT EXISTS shipment_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id      UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id    UUID REFERENCES customer_order_items(id),
  product_id       UUID REFERENCES products(id),
  product_code     TEXT,
  product_name     TEXT NOT NULL,
  unit_name        TEXT,
  qty              NUMERIC NOT NULL DEFAULT 1,
  unit_price       NUMERIC NOT NULL DEFAULT 0,
  subtotal         NUMERIC DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE shipment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner access via shipment" ON shipment_items;
CREATE POLICY "owner access via shipment" ON shipment_items
  USING (EXISTS (
    SELECT 1 FROM shipments
    WHERE shipments.id = shipment_items.shipment_id
    AND shipments.user_id = auth.uid()
  ));
CREATE INDEX IF NOT EXISTS idx_shipment_items_shipment_id ON shipment_items(shipment_id);
