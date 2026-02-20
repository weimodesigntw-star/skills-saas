-- ========================================
-- Migration 008: POS 系統 + 規格系統 資料表
-- 建立 products, orders, order_items, invoices,
-- invoice_track_numbers, specifications, spec_templates
-- ========================================

-- ========================================
-- 1. products (商品表)
-- ========================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT,
  sku TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2),
  stock INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 5,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,

  tax_type TEXT DEFAULT 'taxable',  -- taxable / tax_free / zero_rate
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products USING GIN(to_tsvector('simple', name));

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own products"
  ON products FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 2. orders (訂單表)
-- ========================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending / paid / refunded / voided
  payment_method TEXT,                      -- cash / credit_card / line_pay / easy_card
  payment_reference TEXT,

  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,

  customer_name TEXT,
  customer_phone TEXT,
  note TEXT,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own orders"
  ON orders FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 3. order_items (訂單明細表)
-- ========================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  product_name TEXT NOT NULL,
  product_barcode TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- ========================================
-- 4. invoices (電子發票表)
-- ========================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_type TEXT NOT NULL DEFAULT 'B2C',  -- B2C / B2B

  buyer_identifier TEXT DEFAULT '0000000000',
  buyer_name TEXT,

  carrier_type TEXT,      -- phone_barcode / cert / member
  carrier_id TEXT,
  donate_mark BOOLEAN DEFAULT FALSE,
  donate_code TEXT,

  sales_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,

  status TEXT DEFAULT 'issued',           -- issued / voided / allowanced
  einvoice_status TEXT DEFAULT 'pending', -- pending / uploaded / failed
  einvoice_response JSONB,

  void_reason TEXT,
  void_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 5. invoice_track_numbers (發票字軌管理)
-- ========================================
CREATE TABLE IF NOT EXISTS invoice_track_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  track_prefix TEXT NOT NULL,     -- 字軌（如 AB）
  year_month TEXT NOT NULL,       -- 期別（如 11502 = 114年1-2月）
  start_number INTEGER NOT NULL,
  end_number INTEGER NOT NULL,
  current_number INTEGER NOT NULL,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_track_numbers_user ON invoice_track_numbers(user_id);

ALTER TABLE invoice_track_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own track numbers"
  ON invoice_track_numbers FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 6. specifications (規格表)
-- ========================================
CREATE TABLE IF NOT EXISTS specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'draft',  -- draft / published / archived

  spec_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT,
  ai_model TEXT,

  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_specifications_user_id ON specifications(user_id);
CREATE INDEX IF NOT EXISTS idx_specifications_category ON specifications(category);
CREATE INDEX IF NOT EXISTS idx_specifications_status ON specifications(status);
CREATE INDEX IF NOT EXISTS idx_specifications_created_at ON specifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_specifications_spec_data_gin ON specifications USING GIN(spec_data);
CREATE INDEX IF NOT EXISTS idx_specifications_tags_gin ON specifications USING GIN(tags);

ALTER TABLE specifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own specifications"
  ON specifications FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 7. spec_templates (規格模板表)
-- ========================================
CREATE TABLE IF NOT EXISTS spec_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,
  category TEXT,

  template_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_spec_templates_user_id ON spec_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_spec_templates_public ON spec_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_spec_templates_category ON spec_templates(category);

ALTER TABLE spec_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public templates"
  ON spec_templates FOR SELECT
  USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can manage own templates"
  ON spec_templates
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

-- ========================================
-- 8. Auto-update updated_at triggers
-- ========================================

-- Ensure trigger function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for new tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'products', 'orders', 'invoices', 'specifications', 'spec_templates'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I; CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;
