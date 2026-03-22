-- F-002：可依「低庫存」篩選（stock < low_stock_threshold），供 getProducts 使用
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_low_stock boolean
  GENERATED ALWAYS AS (stock < low_stock_threshold) STORED;

COMMENT ON COLUMN public.products.is_low_stock IS 'F-002: 低於各商品自訂門檻（由 stock、low_stock_threshold 自動計算）';

CREATE INDEX IF NOT EXISTS idx_products_user_low_stock
  ON public.products (user_id)
  WHERE is_low_stock = true AND is_active = true;
