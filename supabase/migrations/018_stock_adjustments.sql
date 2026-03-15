-- ========================================
-- Migration 018: 庫存調整記錄表
-- 前置：確認 Table Editor 無 stock_adjustments 再執行
-- ========================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type         TEXT NOT NULL CHECK (type IN ('restock', 'loss', 'manual')),
  qty_change   INTEGER NOT NULL,
  qty_after    INTEGER NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_user_id ON stock_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at ON stock_adjustments(created_at DESC);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner access" ON stock_adjustments;
DROP POLICY IF EXISTS "Users can manage own stock_adjustments" ON stock_adjustments;
CREATE POLICY "Users can manage own stock_adjustments"
  ON stock_adjustments FOR ALL
  USING (auth.uid() = user_id);
