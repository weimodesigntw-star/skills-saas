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

  // POS 今日訂單與營收
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .gte('created_at', todayISO);

  // POS 本月營收
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .gte('created_at', monthStart);

  // 客戶訂單（customer_orders）今日統計
  const { data: todayCustomerOrders } = await supabase
    .from('customer_orders')
    .select('total')
    .eq('user_id', user.id)
    .gte('created_at', todayISO);

  // 客戶訂單（customer_orders）本月統計
  const { data: monthCustomerOrders } = await supabase
    .from('customer_orders')
    .select('total')
    .eq('user_id', user.id)
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

  const posTodayRevenue = todayOrders?.reduce((s, o) => s + Number(o.total_amount ?? 0), 0) ?? 0;
  const customerTodayRevenue = todayCustomerOrders?.reduce((s, o) => s + Number(o.total ?? 0), 0) ?? 0;
  const posMonthRevenue = monthOrders?.reduce((s, o) => s + Number(o.total_amount ?? 0), 0) ?? 0;
  const customerMonthRevenue = monthCustomerOrders?.reduce((s, o) => s + Number(o.total ?? 0), 0) ?? 0;

  return {
    todayRevenue: posTodayRevenue + customerTodayRevenue,
    todayOrderCount: (todayOrders?.length ?? 0) + (todayCustomerOrders?.length ?? 0),
    monthRevenue: posMonthRevenue + customerMonthRevenue,
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
