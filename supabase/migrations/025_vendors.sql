-- 方案 C S1：廠商主檔（ERP 對應）
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_code TEXT,
  vendor_name TEXT NOT NULL,
  vendor_cat TEXT,
  uniform_num TEXT,
  currency TEXT DEFAULT '台幣',
  tax_type TEXT,
  taxrate NUMERIC DEFAULT 0.05,
  contact TEXT,
  phone TEXT,
  email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_code ON vendors(vendor_code);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON vendors
  USING (user_id = auth.uid());

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
