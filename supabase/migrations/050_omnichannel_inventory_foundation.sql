-- ========================================
-- Migration 050: Omnichannel inventory foundation
-- 目標：
-- 1) 分離主帳(physical) / 通路(EasyStore) / 保留(reserved)
-- 2) 保留 legacy stock 相容，逐步平滑遷移
-- 3) 提供 adjust_inventory RPC 作為新入口
-- ========================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS physical_stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channel_stock_easystore integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reserved_stock integer NOT NULL DEFAULT 0;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_stock integer
  GENERATED ALWAYS AS (GREATEST(physical_stock - reserved_stock, 0)) STORED;

-- Backfill（僅處理預設值狀態，避免覆蓋已人工修正資料）
UPDATE public.products
SET physical_stock = COALESCE(stock, 0)
WHERE stock IS NOT NULL
  AND physical_stock = 0;

UPDATE public.products
SET channel_stock_easystore = COALESCE(stock, 0)
WHERE stock IS NOT NULL
  AND channel_stock_easystore = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_physical_stock_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_physical_stock_non_negative
      CHECK (physical_stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_reserved_stock_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_reserved_stock_non_negative
      CHECK (reserved_stock >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_channel_stock_easystore_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_channel_stock_easystore_non_negative
      CHECK (channel_stock_easystore >= 0);
  END IF;
END $$;

-- Legacy 相容：仍有大量程式讀寫 products.stock
-- 規則：
-- - 寫 stock -> 同步 physical_stock
-- - 寫 physical_stock -> 同步 stock
CREATE OR REPLACE FUNCTION public.sync_products_stock_legacy_columns()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.physical_stock IS NULL AND NEW.stock IS NOT NULL THEN
      NEW.physical_stock := NEW.stock;
    ELSIF NEW.stock IS NULL AND NEW.physical_stock IS NOT NULL THEN
      NEW.stock := NEW.physical_stock;
    ELSIF NEW.stock IS NULL AND NEW.physical_stock IS NULL THEN
      NEW.stock := 0;
      NEW.physical_stock := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.physical_stock IS DISTINCT FROM OLD.physical_stock THEN
    NEW.stock := NEW.physical_stock;
  ELSIF NEW.stock IS DISTINCT FROM OLD.stock THEN
    NEW.physical_stock := NEW.stock;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_products_stock_legacy_columns ON public.products;
CREATE TRIGGER trg_sync_products_stock_legacy_columns
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_products_stock_legacy_columns();

-- 新庫存 RPC：建議新功能與通路同步都走此函式
CREATE OR REPLACE FUNCTION public.adjust_inventory(
  p_product_id uuid,
  p_user_id uuid,
  p_type text,
  p_qty integer,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_physical integer;
  v_reserved integer;
  v_channel integer;
  v_after_physical integer;
  v_after_reserved integer;
  v_after_channel integer;
BEGIN
  IF p_type NOT IN ('restock', 'loss', 'manual', 'reserve', 'release', 'ship', 'sync_channel') THEN
    RAISE EXCEPTION 'invalid type: %', p_type;
  END IF;

  SELECT physical_stock, reserved_stock, channel_stock_easystore
  INTO v_physical, v_reserved, v_channel
  FROM public.products
  WHERE id = p_product_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found or not owned';
  END IF;

  v_after_physical := v_physical;
  v_after_reserved := v_reserved;
  v_after_channel := v_channel;

  CASE p_type
    WHEN 'restock' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'restock qty must be >= 0'; END IF;
      v_after_physical := v_physical + p_qty;
    WHEN 'loss' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'loss qty must be >= 0'; END IF;
      v_after_physical := GREATEST(v_physical - p_qty, 0);
    WHEN 'manual' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'manual qty must be >= 0'; END IF;
      v_after_physical := p_qty;
    WHEN 'reserve' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'reserve qty must be >= 0'; END IF;
      IF (v_physical - (v_reserved + p_qty)) < 0 THEN
        RAISE EXCEPTION 'insufficient available stock';
      END IF;
      v_after_reserved := v_reserved + p_qty;
    WHEN 'release' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'release qty must be >= 0'; END IF;
      v_after_reserved := GREATEST(v_reserved - p_qty, 0);
    WHEN 'ship' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'ship qty must be >= 0'; END IF;
      v_after_physical := GREATEST(v_physical - p_qty, 0);
      v_after_reserved := GREATEST(v_reserved - p_qty, 0);
    WHEN 'sync_channel' THEN
      IF p_qty < 0 THEN RAISE EXCEPTION 'sync_channel qty must be >= 0'; END IF;
      v_after_channel := p_qty;
  END CASE;

  UPDATE public.products
  SET
    physical_stock = v_after_physical,
    reserved_stock = v_after_reserved,
    channel_stock_easystore = v_after_channel,
    updated_at = NOW()
  WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'physical_stock', v_after_physical,
    'reserved_stock', v_after_reserved,
    'available_stock', GREATEST(v_after_physical - v_after_reserved, 0),
    'channel_stock_easystore', v_after_channel
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_inventory(uuid, uuid, text, integer, text) TO authenticated;
