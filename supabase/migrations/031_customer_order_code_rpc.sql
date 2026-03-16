CREATE OR REPLACE FUNCTION generate_order_code(p_user_id UUID, p_prefix TEXT DEFAULT 'BA201')
RETURNS TEXT AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW(), 'YYYYMMDD');
  v_count INTEGER;
  v_code TEXT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM customer_orders
  WHERE user_id = p_user_id
  AND order_code LIKE p_prefix || '-' || v_today || '-%';
  v_code := p_prefix || '-' || v_today || '-' || LPAD((v_count + 1)::TEXT, 4, '0');
  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
