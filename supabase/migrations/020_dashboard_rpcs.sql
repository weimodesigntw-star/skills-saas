-- Dashboard 總覽用 RPC：近 N 日每日營收、熱賣商品 Top N
-- 使用 orders / order_items（quantity），時區 Asia/Taipei

-- 近 N 日每日營收
CREATE OR REPLACE FUNCTION get_daily_revenue(
  p_user_id UUID,
  p_days    INTEGER DEFAULT 7
)
RETURNS TABLE (date TEXT, revenue NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT
    TO_CHAR(created_at AT TIME ZONE 'Asia/Taipei', 'MM/DD') AS date,
    SUM(total_amount)::NUMERIC AS revenue
  FROM orders
  WHERE
    user_id = p_user_id
    AND status = 'paid'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY TO_CHAR(created_at AT TIME ZONE 'Asia/Taipei', 'MM/DD'),
           DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Taipei')
  ORDER BY DATE_TRUNC('day', created_at AT TIME ZONE 'Asia/Taipei');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 熱賣商品 Top N（近 N 日）
CREATE OR REPLACE FUNCTION get_top_products(
  p_user_id UUID,
  p_days    INTEGER DEFAULT 30,
  p_limit   INTEGER DEFAULT 5
)
RETURNS TABLE (name TEXT, total_sold BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.name,
    SUM(oi.quantity)::BIGINT AS total_sold
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  JOIN orders o ON o.id = oi.order_id
  WHERE
    o.user_id = p_user_id
    AND o.status = 'paid'
    AND o.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY p.name
  ORDER BY total_sold DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
