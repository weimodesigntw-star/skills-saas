import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ShoppingCart, Calendar, AlertTriangle } from 'lucide-react';
import { formatNTD, formatNumber } from '@/lib/constants';

type Props = {
  todayRevenue: number;
  todayOrderCount: number;
  monthRevenue: number;
  lowStockCount: number;
};

export function StatsCards({
  todayRevenue,
  todayOrderCount,
  monthRevenue,
  lowStockCount,
}: Props) {
  const cards = [
    {
      label: '今日營收',
      value: formatNTD(todayRevenue),
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      label: '今日訂單',
      value: `${formatNumber(todayOrderCount)} 筆`,
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      label: '本月營收',
      value: formatNTD(monthRevenue),
      icon: Calendar,
      color: 'text-purple-600',
    },
    {
      label: '低庫存商品',
      value: `${formatNumber(lowStockCount)} 項`,
      icon: AlertTriangle,
      color: lowStockCount > 0 ? 'text-red-500' : 'text-gray-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-4 pt-6">
            <Icon className={`h-8 w-8 ${color}`} />
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold">{value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
