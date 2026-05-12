'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

/** 與 get_daily_revenue RPC（Asia/Taipei MM/DD）對齊的標籤 */
function formatMmDdTaipei(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/** 近 N 日曆日（台北）的 MM/DD 標籤，由舊到新，與 RPC 分組方式對齊 */
function lastNDaysMmDdLabelsTaipei(n: number): string[] {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    month: '2-digit',
    day: '2-digit',
  });
  const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setTime(d.getTime() - i * 24 * 60 * 60 * 1000);
    labels.push(fmt.format(d));
  }
  return labels;
}

export async function fetchDashboardStats() {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // POS 今日訂單與營收
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', ownerId)
    .eq('status', 'paid')
    .gte('created_at', todayISO);

  // POS 本月營收
  const { data: monthOrders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('user_id', ownerId)
    .eq('status', 'paid')
    .gte('created_at', monthStart);

  // 客戶訂單（customer_orders）今日統計
  const { data: todayCustomerOrders } = await supabase
    .from('customer_orders')
    .select('total')
    .eq('user_id', ownerId)
    .gte('created_at', todayISO);

  // 客戶訂單（customer_orders）本月統計
  const { data: monthCustomerOrders } = await supabase
    .from('customer_orders')
    .select('total')
    .eq('user_id', ownerId)
    .gte('created_at', monthStart);

  // 低庫存商品數（stock <= 5）
  const { count: lowStockCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', ownerId)
    .lte('stock', 5);

  // 近 7 日每日營收（RPC：僅 POS orders）
  const { data: dailyRevenueRpc } = await supabase.rpc('get_daily_revenue', {
    p_user_id: ownerId,
    p_days: 7,
  });

  // INT-005：合併 customer_orders（與 RPC 相同滾動視窗）
  const windowStart = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: coDailyRows } = await supabase
    .from('customer_orders')
    .select('created_at, total')
    .eq('user_id', ownerId)
    .gte('created_at', windowStart);

  const labelsOrder = lastNDaysMmDdLabelsTaipei(7);
  const mergedByLabel = new Map<string, number>();
  for (const L of labelsOrder) mergedByLabel.set(L, 0);

  for (const d of dailyRevenueRpc ?? []) {
    const row = d as { date: string; revenue: unknown };
    const prev = mergedByLabel.get(row.date) ?? 0;
    mergedByLabel.set(row.date, prev + Number(row.revenue ?? 0));
  }
  for (const row of coDailyRows ?? []) {
    const label = formatMmDdTaipei((row as { created_at: string }).created_at);
    const t = Number((row as { total?: number }).total ?? 0);
    mergedByLabel.set(label, (mergedByLabel.get(label) ?? 0) + t);
  }

  const dailyRevenue = labelsOrder.map((date) => ({
    date,
    revenue: mergedByLabel.get(date) ?? 0,
  }));

  // 熱賣商品 Top 5（近 30 日）（RPC）
  const { data: topProducts } = await supabase.rpc('get_top_products', {
    p_user_id: ownerId,
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
    dailyRevenue,
    topProducts: (topProducts ?? []).map((p: { name: string; total_sold: unknown }) => ({
      name: p.name,
      total_sold: Number(p.total_sold),
    })),
  };
}
