'use client';

/**
 * POS 訂單列表
 * - 狀態篩選、日期區間、分頁
 * - 點擊進入訂單詳情
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatNTD } from '@/lib/constants';
import { fetchOrders, type OrderStatus, type FetchOrdersResult } from '@/app/actions/pos';
import type { Order } from '@/lib/types/pos';
import { ArrowLeft, Search, ChevronLeft, ChevronRight, Receipt } from 'lucide-react';

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: '全部狀態' },
  { value: 'pending', label: '待處理' },
  { value: 'paid', label: '已付款' },
  { value: 'refunded', label: '已退款' },
  { value: 'voided', label: '已作廢' },
];

const PAYMENT_LABELS: Record<string, string> = {
  CASH: '現金',
  CREDIT: '信用卡',
  LINEPAY: 'LINE Pay',
  EASYCARD: '悠遊卡',
  cash: '現金',
  credit_card: '信用卡',
  line_pay: 'LINE Pay',
  easy_card: '悠遊卡',
};

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  switch (status) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'refunded': return 'secondary';
    case 'voided': return 'destructive';
    default: return 'default';
  }
}

export default function OrdersPage() {
  const [result, setResult] = useState<FetchOrdersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOrders({
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize,
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }, [status, dateFrom, dateTo, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/pos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">訂單列表</h1>
          <p className="text-muted-foreground text-sm">POS 訂單紀錄，可篩選狀態與日期</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">狀態</label>
              <select
                value={status}
                onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">日期起</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">日期訖</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-40"
              />
            </div>
            <Button onClick={() => load()} variant="secondary" size="sm">
              <Search className="h-4 w-4 mr-2" />
              查詢
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : result && result.orders.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="尚無訂單"
              description="在 POS 銷售頁面結帳後，訂單會顯示於此"
            />
          ) : result ? (
            <>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">訂單編號</th>
                      <th className="text-left p-3 font-medium">日期</th>
                      <th className="text-left p-3 font-medium">狀態</th>
                      <th className="text-left p-3 font-medium">付款方式</th>
                      <th className="text-right p-3 font-medium">金額</th>
                      <th className="p-3 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.orders.map((order: Order) => (
                      <tr key={order.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono">{order.order_number}</td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(order.created_at).toLocaleString('zh-TW', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="p-3">
                          <Badge variant={statusVariant(order.status)}>
                            {STATUS_OPTIONS.find((o) => o.value === order.status)?.label ?? order.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
                        </td>
                        <td className="p-3 text-right font-medium">
                          {formatNTD(Number(order.total_amount))}
                        </td>
                        <td className="p-3">
                          <Link href={`/dashboard/pos/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">詳情</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    共 {result.total} 筆，第 {result.page} / {totalPages} 頁
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一頁
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      下一頁
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
