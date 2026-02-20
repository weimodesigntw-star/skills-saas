/**
 * Dashboard Overview Page
 *
 * 總覽頁面 — 顯示關鍵指標卡片、7日營收趰勢、熱銷商品、最近訂單
 */

import { createServerClient } from '@/lib/supabase/server';
import { formatNTD, formatNumber } from '@/lib/constants';
import {
  FolderTree,
  Package,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
}

function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

interface RevenueData {
  date: string;
  revenue: number;
}

interface TopProduct {
  product_id: string;
  product_name: string;
  total_qty: number;
  total_revenue: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
}

export default async function DashboardOverviewPage() {
  let categoryCount = 0;
  let productCount = 0;
  let todayOrderCount = 0;
  let todayRevenue = 0;
  let last7DaysRevenue: RevenueData[] = [];
  let topProducts: TopProduct[] = [];
  let recentOrders: RecentOrder[] = [];

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 分類數量
      const { count: categories } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      categoryCount = categories ?? 0;

      // 商品數量（啟用中）
      const { count: products } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      productCount = products ?? 0;

      // 今日訂單數 & 營收
      const today = new Date().toISOString().split('T')[0];
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      todayOrderCount = todayOrders?.length ?? 0;
      todayRevenue = todayOrders?.reduce((sum, o) => sum + Number(o.total_amount), 0) ?? 0;

      // 近 7 日營收（按日期分組）
      const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data: last7Orders } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .gte('created_at', `${sevenDaysAgo}T00:00:00`)
        .order('created_at', { ascending: true });

      const revenueByDate: Record<string, number> = {};
      last7Orders?.forEach(order => {
        const date = order.created_at.split('T')[0];
        revenueByDate[date] = (revenueByDate[date] ?? 0) + Number(order.total_amount);
      });

      // 生成過去 7 天的日期
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        last7DaysRevenue.push({
          date: dateStr,
          revenue: revenueByDate[dateStr] ?? 0,
        });
      }

      // 熱銷商品 Top 5 — Fallback: fetch and aggregate in JS
      try {
        const { data: orderIds } = await supabase
          .from('orders')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'paid');

        if (orderIds && orderIds.length > 0) {
          const { data: allItems } = await supabase
            .from('order_items')
            .select('product_id, product_name, quantity, subtotal')
            .in('order_id', orderIds.map(o => o.id));

          const aggregated: Record<string, TopProduct> = {};
          allItems?.forEach(item => {
            const key = item.product_id || item.product_name;
            if (!aggregated[key]) {
              aggregated[key] = {
                product_id: item.product_id,
                product_name: item.product_name,
                total_qty: 0,
                total_revenue: 0,
              };
            }
            aggregated[key].total_qty += item.quantity;
            aggregated[key].total_revenue += Number(item.subtotal);
          });

          topProducts = Object.values(aggregated)
            .sort((a, b) => b.total_qty - a.total_qty)
            .slice(0, 5);
        }
      } catch (topProdError) {
        console.error('Failed to fetch top products:', topProdError);
      }

      // 最近 5 筆訂單
      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_method, created_at')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(5);

      recentOrders = recent ?? [];
    }
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }

  // Format date for display (YYYY-MM-DD -> MM-DD)
  const formatDateShort = (dateStr: string) => {
    return dateStr.substring(5); // MM-DD
  };

  // Get max value for bar chart scaling
  const maxRevenue = Math.max(...last7DaysRevenue.map(d => d.revenue), 1);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">總覽</h1>
        <p className="text-muted-foreground mt-1">歡迎回來！以下是您的系絭概況。</p>
      </div>

      {/* 4 StatCards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="分類數量"
          value={categoryCount}
          description="已建立的分類節點"
          icon={FolderTree}
        />
        <StatCard
          title="商品數量"
          value={productCount}
          description="已建立的商品"
          icon={Package}
        />
        <StatCard
          title="今日訂單"
          value={todayOrderCount}
          description={formatNTD(todayRevenue)}
          icon={ShoppingCart}
        />
        <StatCard
          title="今日營收"
          value={formatNTD(todayRevenue)}
          description="已付款訂單"
          icon={TrendingUp}
        />
      </div>

      {/* 近 7 日營收 */}
      <div className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-6">近 7 日營收</h2>
        <div className="flex items-flex-end gap-2 h-64">
          {last7DaysRevenue.map(item => {
            const height = maxRevenue > 0 ? (item.revenue / maxRevenue) * 100 : 0;
            return (
              <div key={item.date} className="flex-1 flex flex-col items-center justify-end">
                <div className="text-xs font-medium mb-2 text-muted-foreground">
                  {formatNTD(item.revenue)}
                </div>
                <div
                  className="w-full bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                  style={{ height: `${Math.max(height, 5)}%` }}
                />
                <div className="text-xs text-muted-foreground mt-2">
                  {formatDateShort(item.date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 熱銷商品 Top 5 */}
      <div className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-6">熱銷商品 Top 5</h2>
        {topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-semibold">商品名稱</th>
                  <th className="text-right py-3 px-3 font-semibold">銷售數量</th>
                  <th className="text-right py-3 px-3 font-semibold">營收</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((product, idx) => (
                  <tr key={product.product_id || idx} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-3">{product.product_name}</td>
                    <td className="text-right py-3 px-3">{formatNumber(product.total_qty)}</td>
                    <td className="text-right py-3 px-3 font-medium">{formatNTD(product.total_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">暫無銷售數據</p>
        )}
      </div>

      {/* 最近訂單 */}
      <div className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold mb-6">最近訂單</h2>
        {recentOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 font-semibold">訂單號</th>
                  <th className="text-left py-3 px-3 font-semibold">付款方式</th>
                  <th className="text-right py-3 px-3 font-semibold">金額</th>
                  <th className="text-left py-3 px-3 font-semibold">時間</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(order => {
                  const orderTime = new Date(order.created_at);
                  const timeStr = orderTime.toLocaleString('zh-TW', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <tr key={order.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-3 font-mono">{order.order_number}</td>
                      <td className="py-3 px-3 text-xs">{order.payment_method || '—'}</td>
                      <td className="text-right py-3 px-3 font-medium">{formatNTD(order.total_amount)}</td>
                      <td className="py-3 px-3 text-muted-foreground">{timeStr}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">暫無訂單</p>
        )}
      </div>
    </div>
  );
}
