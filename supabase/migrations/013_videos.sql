-- ========================================
-- Migration 013: 影片管理系統
-- ========================================

-- ========================================
-- 1. video_categories (影片分類表)
-- ========================================
CREATE TABLE IF NOT EXISTS video_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_categories_user_id ON video_categories(user_id);

ALTER TABLE video_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own video categories"
  ON video_categories FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 2. videos (影片主表)
-- ========================================
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  summary TEXT,

  -- 影片來源
  video_url TEXT NOT NULL DEFAULT '',
  video_platform TEXT DEFAULT 'youtube',  -- youtube | vimeo | custom
  video_embed_id TEXT,                     -- 影片平台的 ID
  duration TEXT,                           -- 影片時長，如 "12:34"

  -- 縮圖
  thumbnail_url TEXT,

  -- 分類與設定
  category_id UUID REFERENCES video_categories(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,       -- 精選影片（類似新聞置頂）
  sort_order INTEGER DEFAULT 0,

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category_id ON videos(category_id);
CREATE INDEX IF NOT EXISTS idx_videos_featured ON videos(is_featured DESC, sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_sort_order ON videos(sort_order);

ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own videos"
  ON videos FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 3. video_related (相關影片關聯表)
-- ========================================
CREATE TABLE IF NOT EXISTS video_related (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  related_video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(video_id, related_video_id)
);

CREATE INDEX IF NOT EXISTS idx_video_related_video_id ON video_related(video_id);
CREATE INDEX IF NOT EXISTS idx_video_related_related_id ON video_related(related_video_id);

ALTER TABLE video_related ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own video relations"
  ON video_related FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 4. 自動更新 updated_at 觸發器
-- ========================================
CREATE OR REPLACE FUNCTION update_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW
  EXECUTE FUNCTION update_videos_updated_at();

CREATE OR REPLACE FUNCTION update_video_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_video_categories_updated_at
  BEFORE UPDATE ON video_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_video_categories_updated_at();
