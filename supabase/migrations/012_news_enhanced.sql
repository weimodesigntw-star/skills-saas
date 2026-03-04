-- ========================================
-- Migration 012: 最新消息功能增強
-- 參考 YOUNGA 後台消息管理模式
-- ========================================

-- ========================================
-- 1. news_categories (消息分類表)
-- ========================================
CREATE TABLE IF NOT EXISTS news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_categories_user_id ON news_categories(user_id);

ALTER TABLE news_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own news categories"
  ON news_categories FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 2. 擴充 news 表欄位
-- ========================================
-- 分類
ALTER TABLE news ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES news_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_news_category_id ON news(category_id);

-- 摘要
ALTER TABLE news ADD COLUMN IF NOT EXISTS summary TEXT;

-- 置頂
ALTER TABLE news ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_news_pinned ON news(is_pinned DESC, sort_order);

-- 內容區塊 (JSON 格式，存放段落和圖片區塊)
-- 格式: [{ type: 'text' | 'image', content: string, imageUrl?: string, caption?: string, maxWidth?: string, align?: string }]
ALTER TABLE news ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT '[]'::jsonb;

-- ========================================
-- 3. news_related (相關消息關聯表)
-- ========================================
CREATE TABLE IF NOT EXISTS news_related (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  related_news_id UUID NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(news_id, related_news_id)
);

CREATE INDEX IF NOT EXISTS idx_news_related_news_id ON news_related(news_id);
CREATE INDEX IF NOT EXISTS idx_news_related_related_id ON news_related(related_news_id);

ALTER TABLE news_related ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own news relations"
  ON news_related FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 4. Auto-update updated_at trigger for news_categories
-- ========================================
DO $$
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS update_news_categories_updated_at ON news_categories; CREATE TRIGGER update_news_categories_updated_at BEFORE UPDATE ON news_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();'
  );
END;
$$;
