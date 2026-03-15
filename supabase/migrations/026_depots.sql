-- 方案 C S1：倉庫主檔（ERP 對應）
CREATE TABLE IF NOT EXISTS depots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  depot_code TEXT,
  depot_name TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_depots_user_id ON depots(user_id);

ALTER TABLE depots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner access" ON depots
  USING (user_id = auth.uid());

CREATE TRIGGER depots_updated_at
  BEFORE UPDATE ON depots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
