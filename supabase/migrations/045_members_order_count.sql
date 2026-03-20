ALTER TABLE members
ADD COLUMN IF NOT EXISTS order_count INTEGER NOT NULL DEFAULT 0;

UPDATE members
SET order_count = COALESCE(visit_count, 0)
WHERE order_count = 0;
