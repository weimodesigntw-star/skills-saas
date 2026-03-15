import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, ShoppingCart, Calendar, AlertTriangle } from 'lucide-react';

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
      value: `NT$ ${todayRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-green-600',
    },
    {
      label: '今日訂單',
      value: `${todayOrderCount} 筆`,
      icon: ShoppingCart,
      color: 'text-blue-600',
    },
    {
      label: '本月營收',
      value: `NT$ ${monthRevenue.toLocaleString()}`,
      icon: Calendar,
      color: 'text-purple-600',
    },
    {
      label: '低庫存商品',
      value: `${lowStockCount} 項`,
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
