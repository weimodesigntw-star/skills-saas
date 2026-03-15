'use server';

import { createServerClient } from '@/lib/supabase/server';

export async function fetchDashboardStats() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // 今日訂單與營收
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .gte('created_at', todayISO);

  // 本月營收
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .gte('created_at', monthStart);

  // 低庫存商品數（stock <= 5）
  const { count: lowStockCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('stock', 5);

  // 近 7 日每日營收（RPC）
  const { data: dailyRevenue } = await supabase.rpc('get_daily_revenue', {
    p_user_id: user.id,
    p_days: 7,
  });

  // 熱賣商品 Top 5（近 30 日）（RPC）
  const { data: topProducts } = await supabase.rpc('get_top_products', {
    p_user_id: user.id,
    p_days: 30,
    p_limit: 5,
  });

  return {
    todayRevenue: todayOrders?.reduce((s, o) => s + Number(o.total_amount ?? 0), 0) ?? 0,
    todayOrderCount: todayOrders?.length ?? 0,
    monthRevenue: monthOrders?.reduce((s, o) => s + Number(o.total_amount ?? 0), 0) ?? 0,
    lowStockCount: lowStockCount ?? 0,
    dailyRevenue: (dailyRevenue ?? []).map((d: { date: string; revenue: unknown }) => ({
      date: d.date,
      revenue: Number(d.revenue),
    })),
    topProducts: (topProducts ?? []).map((p: { name: string; total_sold: unknown }) => ({
      name: p.name,
      total_sold: Number(p.total_sold),
    })),
  };
}
