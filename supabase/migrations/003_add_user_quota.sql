-- ============================================
-- 用戶配額與訂閱狀態 Migration
-- ============================================
-- 此腳本為 profiles 表新增以下欄位：
-- 1. tier: 訂閱層級 ('free', 'pro')
-- 2. ai_usage_count: 當天 AI 使用次數
-- 3. last_reset_date: 最後重置日期
-- 4. stripe_customer_id: Stripe 客戶 ID（預留）
-- 5. stripe_subscription_id: Stripe 訂閱 ID（預留）
-- ============================================

-- 檢查 profiles 表是否存在，如果不存在則創建
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新增訂閱層級欄位
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro'));

-- 新增 AI 使用次數欄位
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ai_usage_count INTEGER DEFAULT 0;

-- 新增最後重置日期欄位
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMPTZ DEFAULT NOW();

-- 新增 Stripe 客戶 ID 欄位（預留）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- 新增 Stripe 訂閱 ID 欄位（預留）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON profiles(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- 為現有用戶設置默認值（如果欄位為 NULL）
UPDATE profiles 
SET 
  tier = COALESCE(tier, 'free'),
  ai_usage_count = COALESCE(ai_usage_count, 0),
  last_reset_date = COALESCE(last_reset_date, NOW())
WHERE tier IS NULL OR ai_usage_count IS NULL OR last_reset_date IS NULL;

-- 啟用 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用戶只能查看和更新自己的資料
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 創建觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
