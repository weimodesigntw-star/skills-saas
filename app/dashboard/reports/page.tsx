/**
 * Dashboard Reports Page
 *
 * 完整報告頁面 — 日期篩選、營收摘要、圖表、訂單列表
 */

import { createServerClient } from '@/lib/supabase/server';
import { formatNTD, formatNumber } from '@/lib/constants';
import BarChart from '@/components/charts/BarChart';
import HorizontalBar from '@/components/charts/HorizontalBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

interface RevenueDay {
  date: string;
  revenue: number;
}

interface PaymentBreakdown {
  method: string;
  amount: number;
}

interface TopProduct {
  rank: number;
  name: string;
  qty: number;
  revenue: number;
}

interface OrderData {
  id: string;
  order_number: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  customer_name?: string;
}

export default async function ReportsPage() {
  let revenueByDay: RevenueDay[] = [];
  let paymentBreakdown: PaymentBreakdown[] = [];
  let topProducts: TopProduct[] = [];
  let recentOrders: OrderData[] = [];

  let totalRevenue = 0;
  let totalOrders = 0;
  let avgOrderValue = 0;
  let invoiceCount = 0;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // 本月期間（簡化：過去 30 天）
      const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];

      // 獲取本月所有已付款訂單
      const { data: monthlyOrders } = await supabase
        .from('orders')
        .select('id, created_at, total_amount, payment_method, customer_name, order_number')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`)
        .order('created_at', { ascending: false });

      // 計算摘要統計
      if (monthlyOrders && monthlyOrders.length > 0) {
        totalRevenue = monthlyOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        totalOrders = monthlyOrders.length;
        avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // 按日期分組營收
        const revenueMap: Record<string, number> = {};
        monthlyOrders.forEach(order => {
          const date = order.created_at.split('T')[0];
          revenueMap[date] = (revenueMap[date] ?? 0) + Number(order.total_amount);
        });

        // 按付款方式分組
        const paymentMap: Record<string, number> = {};
        monthlyOrders.forEach(order => {
          const method = order.payment_method || 'unknown';
          paymentMap[method] = (paymentMap[method] ?? 0) + Number(order.total_amount);
        });

        // 生成過去 30 天的資料
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
          const dateStr = d.toISOString().split('T')[0];
          revenueByDay.push({
            date: dateStr,
            revenue: revenueMap[dateStr] ?? 0,
          });
        }

        // 轉換付款方式為標籤並排序
        paymentBreakdown = Object.entries(paymentMap)
          .map(([method, amount]) => ({
            method:
              method === 'cash' ? '現金' :
              method === 'credit_card' ? '信用卡' :
              method === 'line_pay' ? 'LINE Pay' :
              method === 'easy_card' ? '悠遊卡' :
              method,
            amount: amount as number,
          }))
          .sort((a, b) => b.amount - a.amount);
      }

      // 熱銷商品 Top 10
      const { data: allItems } = await supabase
        .from('order_items')
        .select('product_name, quantity, subtotal')
        .in(
          'order_id',
          monthlyOrders?.map(o => o.id) ?? []
        );

      if (allItems && allItems.length > 0) {
        const productMap: Record<string, { qty: number; revenue: number }> = {};
        allItems.forEach(item => {
          const name = item.product_name;
          if (!productMap[name]) {
            productMap[name] = { qty: 0, revenue: 0 };
          }
          productMap[name].qty += item.quantity;
          productMap[name].revenue += Number(item.subtotal);
        });

        topProducts = Object.entries(productMap)
          .map(([name, data], idx) => ({
            rank: idx + 1,
            name,
            qty: data.qty,
            revenue: data.revenue,
          }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10);
      }

      // 最近 10 筆訂單
      const { data: recent } = await supabase
        .from('orders')
        .select('id, order_number, total_amount, payment_method, created_at, customer_name')
        .eq('user_id', user.id)
        .eq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(10);

      recentOrders = recent ?? [];

      // 發票數量（簡化：這裡示意，實際可查 invoices 表）
      const { count: invCount } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', `${thirtyDaysAgo}T00:00:00`);

      invoiceCount = invCount ?? 0;
    }
  } catch (error) {
    console.error('Failed to load reports data:', error);
  }

  // 準備圖表資料
  const chartColors = [
    'hsl(217, 91%, 60%)', // blue
    'hsl(142, 76%, 36%)', // green
    'hsl(0, 84%, 60%)',   // red
    'hsl(38, 92%, 50%)',  // yellow
    'hsl(280, 85%, 49%)', // purple
  ];

  const paymentChartData = paymentBreakdown.map((item, idx) => ({
    label: item.method,
    value: item.amount,
    color: chartColors[idx % chartColors.length],
  }));

  const revenueChartData = revenueByDay.map(item => ({
    label: item.date.substring(5), // MM-DD format
    value: item.revenue,
    color: 'hsl(217, 91%, 60%)', // blue
  }));

  const formatDateShort = (dateStr: string) => dateStr.substring(5);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">報告</h1>
        <p className="text-muted-foreground mt-1">過去 30 天的營業報告和分析</p>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">總營收</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNTD(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">過去 30 天</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">訂單數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalOrders)}</div>
            <p className="text-xs text-muted-foreground mt-1">已付款訂單</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">平均訂單值</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNTD(avgOrderValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">AOV</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">發票數</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(invoiceCount)}</div>
            <p className="text-xs text-muted-foreground mt-1">已開立</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Day Chart */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>日營收趨勢</CardTitle>
          <CardDescription>過去 30 天的每日營收</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <BarChart
              data={revenueChartData}
              height={300}
              showLabels={true}
            />
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Chart */}
      {paymentChartData.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>按付款方式分類</CardTitle>
            <CardDescription>營收結構分析</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <HorizontalBar
                data={paymentChartData}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products Table */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>熱銷商品 Top 10</CardTitle>
          <CardDescription>按銷售數量排序</CardDescription>
        </CardHeader>
        <CardContent>
          {topProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 font-semibold w-12">排名</th>
                    <th className="text-left py-3 px-3 font-semibold">商品名稱</th>
                    <th className="text-right py-3 px-3 font-semibold">銷售數量</th>
                    <th className="text-right py-3 px-3 font-semibold">營收</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map(product => (
                    <tr key={`${product.rank}-${product.name}`} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-3 font-bold text-center">{product.rank}</td>
                      <td className="py-3 px-3">{product.name}</td>
                      <td className="text-right py-3 px-3">{formatNumber(product.qty)}</td>
                      <td className="text-right py-3 px-3 font-medium">{formatNTD(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">暫無商品銷售數據</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>最近訂單</CardTitle>
          <CardDescription>最新 10 筆已付款訂單</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-3 font-semibold">訂單號</th>
                    <th className="text-left py-3 px-3 font-semibold">客戶</th>
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
                        <td className="py-3 px-3 font-mono text-xs">{order.order_number}</td>
                        <td className="py-3 px-3 text-xs">{order.customer_name || '—'}</td>
                        <td className="py-3 px-3 text-xs">
                          {order.payment_method === 'cash' ? '現金' :
                           order.payment_method === 'credit_card' ? '信用卡' :
                           order.payment_method === 'line_pay' ? 'LINE Pay' :
                           order.payment_method === 'easy_card' ? '悠遊卡' :
                           order.payment_method || '—'}
                        </td>
                        <td className="text-right py-3 px-3 font-medium">{formatNTD(order.total_amount)}</td>
                        <td className="py-3 px-3 text-muted-foreground text-xs">{timeStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">暫無訂單</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
