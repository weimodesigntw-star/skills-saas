-- ========================================
-- Migration 010: Fix Missing Tables and Add Missing Columns
-- Creates: products, order_items, invoices, invoice_track_numbers
-- Adds missing columns to orders table
-- Creates RPC functions and triggers
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

DROP POLICY IF EXISTS "Users can manage own products" ON products;
CREATE POLICY "Users can manage own products"
  ON products FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 2. Fix orders table - Add missing columns
-- ========================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure orders table has RLS enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own orders" ON orders;
CREATE POLICY "Users can manage own orders"
  ON orders FOR ALL
  USING (auth.uid() = user_id);

-- Add indexes to orders if not present
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

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

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;
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

DROP POLICY IF EXISTS "Users can manage own invoices" ON invoices;
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

DROP POLICY IF EXISTS "Users can manage own track numbers" ON invoice_track_numbers;
CREATE POLICY "Users can manage own track numbers"
  ON invoice_track_numbers FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 6. Auto-update updated_at trigger function
-- ========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 7. Create triggers for tables with updated_at
-- ========================================
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 8. POS Order Creation RPC Function
-- ========================================
CREATE OR REPLACE FUNCTION create_pos_order(
  p_user_id UUID,
  p_payment_method TEXT,
  p_items JSONB,            -- [{ "product_id": "uuid", "quantity": 1, "unit_price": 300 }]
  p_discount_amount DECIMAL DEFAULT 0,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal DECIMAL := 0;
  v_tax_amount DECIMAL := 0;
  v_total DECIMAL := 0;
  v_item JSONB;
  v_stock INTEGER;
  v_product_name TEXT;
  v_product_barcode TEXT;
  v_item_subtotal DECIMAL;
  v_today_count INTEGER;
BEGIN
  -- 1. 生成今日訂單編號 POS-YYYYMMDD-NNNN
  SELECT COALESCE(COUNT(*), 0) INTO v_today_count
  FROM orders
  WHERE user_id = p_user_id
  AND created_at::date = CURRENT_DATE;

  v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD((v_today_count + 1)::TEXT, 4, '0');

  -- 2. 驗證庫存 & 計算金額
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- FOR UPDATE 鎖定商品行，防止並發超賣
    SELECT stock, name, barcode
    INTO v_stock, v_product_name, v_product_barcode
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION '商品不存在 (ID: %)', v_item->>'product_id';
    END IF;

    IF v_stock < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION '商品「%」庫存不足（剩餘 %，需要 %）',
        v_product_name, v_stock, (v_item->>'quantity')::INTEGER;
    END IF;

    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  -- 3. 計算稅額（台灣營業稅 5%，內含式: 稅額 = 含稅金額 × 5 ÷ 105）
  v_tax_amount := ROUND(v_subtotal * 5 / 105, 0);
  v_total := v_subtotal - p_discount_amount;

  -- 4. 建立訂單主表
  INSERT INTO orders (
    id, user_id, order_number, status, payment_method,
    subtotal, tax_amount, discount_amount, total_amount, note
  )
  VALUES (
    gen_random_uuid(), p_user_id, v_order_number, 'paid', p_payment_method,
    v_subtotal, v_tax_amount, p_discount_amount, v_total, p_note
  )
  RETURNING id INTO v_order_id;

  -- 5. 寫入明細 & 扣庫存
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT name, barcode INTO v_product_name, v_product_barcode
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;

    -- 寫入訂單明細（快照商品資訊）
    INSERT INTO order_items (
      order_id, product_id, product_name, product_barcode,
      quantity, unit_price, subtotal
    )
    VALUES (
      v_order_id, (v_item->>'product_id')::UUID, v_product_name, v_product_barcode,
      (v_item->>'quantity')::INTEGER, (v_item->>'unit_price')::DECIMAL, v_item_subtotal
    );

    -- 扣減庫存
    UPDATE products
    SET stock = stock - (v_item->>'quantity')::INTEGER,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 授權 authenticated 用戶呼叫
GRANT EXECUTE ON FUNCTION create_pos_order TO authenticated;
