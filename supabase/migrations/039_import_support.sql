-- 匯入功能支援：products.unit_name、upsert 用唯一約束、members.is_active

-- 1. 產品標準單位（ERP 匯入用）
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_name TEXT;

-- 2. 產品依 user_id + product_code 唯一（upsert 去重用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_product_code
  ON products(user_id, product_code) WHERE product_code IS NOT NULL AND product_code != '';

-- 3. 會員依 user_id + client_code 唯一（upsert 去重用）
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_user_client_code
  ON members(user_id, client_code) WHERE client_code IS NOT NULL AND client_code != '';

-- 4. 會員停用旗標（ERP 匯入用）
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
