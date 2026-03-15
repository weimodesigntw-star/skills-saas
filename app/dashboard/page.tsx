/**
 * Dashboard Overview Page
 *
 * 總覽頁面 — 指標卡、近 7 日營收折線圖、熱賣商品 Top 5 橫條圖
 */

import { fetchDashboardStats } from '@/app/actions/dashboard';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { TopProductsChart } from '@/components/dashboard/TopProductsChart';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const stats = await fetchDashboardStats();

  if (!stats) return null;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-xl font-semibold">總覽</h1>

      <StatsCards
        todayRevenue={stats.todayRevenue}
        todayOrderCount={stats.todayOrderCount}
        monthRevenue={stats.monthRevenue}
        lowStockCount={stats.lowStockCount}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RevenueChart data={stats.dailyRevenue} />
        <TopProductsChart data={stats.topProducts} />
      </div>
    </div>
  );
}
