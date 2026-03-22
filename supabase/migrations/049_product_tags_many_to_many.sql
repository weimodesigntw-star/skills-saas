-- ============================================
-- Migration 049: product_tags 多對多（方案 B）
-- ============================================
-- product_tags：每租戶標籤定義（name + color + dimension）
-- product_tag_map：商品 ↔ 標籤
--
-- 執行後請在 Supabase 手動跑 seeds/product_tags_default.sql（TAGS-002）
-- ============================================

-- -----------------------------------------------------------------------------
-- 1. product_tags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  dimension TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT product_tags_user_name_unique UNIQUE (user_id, name)
);

COMMENT ON TABLE public.product_tags IS '商品標籤定義（每使用者獨立；顏色供 UI 色塊）';
COMMENT ON COLUMN public.product_tags.color IS 'HEX 色碼，例如 #f97316';
COMMENT ON COLUMN public.product_tags.dimension IS '維度分組：品項、工藝、染色、素材、系列';

CREATE INDEX IF NOT EXISTS idx_product_tags_user_id ON public.product_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_product_tags_user_dimension_sort
  ON public.product_tags(user_id, dimension, sort_order);

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own product_tags" ON public.product_tags;
CREATE POLICY "Users manage own product_tags"
  ON public.product_tags
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS product_tags_updated_at ON public.product_tags;
CREATE TRIGGER product_tags_updated_at
  BEFORE UPDATE ON public.product_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. product_tag_map
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_tag_map (
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.product_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, tag_id)
);

COMMENT ON TABLE public.product_tag_map IS '商品與標籤多對多；刪商品或標籤時級聯清除關聯';

CREATE INDEX IF NOT EXISTS idx_product_tag_map_tag_id ON public.product_tag_map(tag_id);
CREATE INDEX IF NOT EXISTS idx_product_tag_map_product_id ON public.product_tag_map(product_id);

ALTER TABLE public.product_tag_map ENABLE ROW LEVEL SECURITY;

-- 必須同時擁有商品與標籤（同 user）
DROP POLICY IF EXISTS "Users manage own product_tag_map" ON public.product_tag_map;
CREATE POLICY "Users manage own product_tag_map"
  ON public.product_tag_map
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_tag_map.product_id AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.product_tags t
      WHERE t.id = product_tag_map.tag_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_tag_map.product_id AND p.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.product_tags t
      WHERE t.id = product_tag_map.tag_id AND t.user_id = auth.uid()
    )
  );
