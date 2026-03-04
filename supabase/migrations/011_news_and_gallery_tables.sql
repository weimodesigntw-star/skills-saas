-- ========================================
-- Migration 011: 最新消息 + 照片集 資料表
-- ========================================

-- ========================================
-- 1. news (最新消息表)
-- ========================================
CREATE TABLE IF NOT EXISTS news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content TEXT,
  cover_image_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_user_id ON news(user_id);
CREATE INDEX IF NOT EXISTS idx_news_published ON news(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_sort_order ON news(sort_order);

ALTER TABLE news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own news"
  ON news FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 2. galleries (照片集表)
-- ========================================
CREATE TABLE IF NOT EXISTS galleries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_galleries_user_id ON galleries(user_id);
CREATE INDEX IF NOT EXISTS idx_galleries_sort_order ON galleries(sort_order);

ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own galleries"
  ON galleries FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 3. gallery_photos (照片表)
-- ========================================
CREATE TABLE IF NOT EXISTS gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id UUID NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_gallery_id ON gallery_photos(gallery_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_user_id ON gallery_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_sort_order ON gallery_photos(sort_order);

ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own gallery photos"
  ON gallery_photos FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 4. Auto-update updated_at triggers
-- ========================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['news', 'galleries']) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I; CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;
