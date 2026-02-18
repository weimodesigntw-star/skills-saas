'use client';

/**
 * Order History Page
 *
 * Displays POS orders in a table with:
 * - Pagination
 * - Date range filtering
 * - Status badges
 * - Click to view details
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrders } from '@/app/actions/pos';
import { Order } from '@/lib/types/pos';
import { Button } from '@/components/ui/button';
import { formatNTD } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  ORDER_STATUS_CONFIG,
  getPaymentMethodLabel,
} from '@/lib/utils/pos-helpers';

type DateRange = 'today' | 'week' | 'month' | 'all';

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const { orders: data, total: count } = await getOrders(page, pageSize);
        setOrders(data);
        setTotal(count);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [page]);

  const getStatusBadge = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };

    return (
      <Badge variant={config.variant} className="whitespace-nowrap">
        {config.label}
      </Badge>
    );
  };

  const handleRowClick = (orderId: string) => {
    router.push(`/dashboard/pos/orders/${orderId}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">訂單歷史</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 筆訂單
          </p>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['today', 'week', 'month', 'all'] as const).map((range) => {
          const labels: Record<DateRange, string> = {
            today: '今天',
            week: '本週',
            month: '本月',
            all: '全部',
          };

          return (
            <Button
              key={range}
              variant={dateRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setDateRange(range);
                setPage(0);
              }}
            >
              {labels[range]}
            </Button>
          );
        })}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            載入中...
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            沒有訂單
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">訂單號</th>
                    <th className="px-6 py-3 text-left font-medium">日期</th>
                    <th className="px-6 py-3 text-left font-medium">項目數</th>
                    <th className="px-6 py-3 text-right font-medium">金額</th>
                    <th className="px-6 py-3 text-left font-medium">付款方式</th>
                    <th className="px-6 py-3 text-left font-medium">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const metadata = order.metadata as Record<string, unknown> | null;
                    const itemCount = (metadata?.item_count as number) || 0;
                    return (
                      <tr
                        key={order.id}
                        onClick={() => handleRowClick(order.id)}
                        className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-3 font-medium text-primary">
                          {order.order_number || '-'}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {new Date(order.created_at).toLocaleString('zh-TW', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-3">
                          {itemCount} 項
                        </td>
                        <td className="px-6 py-3 text-right font-bold">
                          {formatNTD(order.total_amount || 0)}
                        </td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {getPaymentMethodLabel(order.payment_method)}
                        </td>
                        <td className="px-6 py-3">
                          {getStatusBadge(order.status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 flex items-center justify-between border-t bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  第 {page + 1} / {totalPages} 頁
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage(Math.min(totalPages - 1, page + 1))
                    }
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
