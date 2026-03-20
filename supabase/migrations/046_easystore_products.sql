ALTER TABLE products
ADD COLUMN IF NOT EXISTS easystore_product_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_easystore_uid_unique'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_easystore_uid_unique UNIQUE (user_id, easystore_product_id);
  END IF;
END $$;
