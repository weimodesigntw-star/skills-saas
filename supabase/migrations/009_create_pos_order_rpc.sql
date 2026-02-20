-- ========================================
-- Migration 009: POS 安全建單 RPC Function
-- 在一個 Transaction 內完成：建訂單 + 寫明細 + 扣庫存
-- 使用 FOR UPDATE 行鎖定防止超賣
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
