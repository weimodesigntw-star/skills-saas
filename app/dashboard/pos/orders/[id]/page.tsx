'use client';

/**
 * Order Detail Page
 *
 * Displays detailed view of a single order:
 * - Order header with status and payment method
 * - Items table with product details
 * - Summary with totals and tax
 * - Back button to return to order list
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getOrderDetail } from '@/app/actions/pos';
import { Order, OrderItem } from '@/lib/types/pos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatNTD, ORDER_STATUS_LABELS } from '@/lib/constants';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import {
  ORDER_STATUS_CONFIG,
  getPaymentMethodLabel,
} from '@/lib/utils/pos-helpers';

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrderDetail = async () => {
      try {
        setLoading(true);
        const result = await getOrderDetail(orderId);

        if (!result) {
          setError('訂單不存在');
          return;
        }

        setOrder(result.order);
        setItems(result.items);
      } catch (err) {
        const message = err instanceof Error ? err.message : '載入訂單失敗';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId]);

  const getStatusBadge = (status: string) => {
    const config = ORDER_STATUS_CONFIG[status] || { label: status, variant: 'outline' as const };

    return (
      <Badge variant={config.variant}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </Button>
        <div className="text-center text-muted-foreground">
          載入中...
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </Button>

        <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">錯誤</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        返回
      </Button>

      {/* Order Header */}
      <div className="border rounded-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{order.order_number}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {new Date(order.created_at).toLocaleString('zh-TW')}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            {getStatusBadge(order.status)}
            <p className="text-lg font-bold text-primary">
              {formatNTD(order.total_amount)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-4 border-t">
          <div>
            <p className="text-muted-foreground">付款方式</p>
            <p className="font-medium">{getPaymentMethodLabel(order.payment_method)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">訂單狀態</p>
            <p className="font-medium">{ORDER_STATUS_LABELS[order.status] || order.status}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-6 py-3 text-left font-medium">商品名稱</th>
                <th className="px-6 py-3 text-left font-medium">條碼</th>
                <th className="px-6 py-3 text-right font-medium">數量</th>
                <th className="px-6 py-3 text-right font-medium">單價</th>
                <th className="px-6 py-3 text-right font-medium">小計</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/30">
                  <td className="px-6 py-3 font-medium">
                    {item.product_name}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground text-xs font-mono">
                    {item.product_barcode || '-'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {formatNTD(item.unit_price)}
                  </td>
                  <td className="px-6 py-3 text-right font-bold">
                    {formatNTD(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="border rounded-lg p-6 bg-muted/30 space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">小計</p>
            <p className="font-bold text-lg">
              {formatNTD(order.subtotal)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">稅額</p>
            <p className="font-bold text-lg">
              {formatNTD(order.tax_amount)}
            </p>
          </div>
          {order.discount_amount > 0 && (
            <div>
              <p className="text-muted-foreground">折扣</p>
              <p className="font-bold text-lg text-destructive">
                -{formatNTD(order.discount_amount)}
              </p>
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex justify-between items-center">
          <p className="font-semibold">總計</p>
          <p className="text-2xl font-bold text-primary">
            {formatNTD(order.total_amount)}
          </p>
        </div>
      </div>

      {/* Additional Info */}
      {order.note && (
        <div className="border rounded-lg p-6 space-y-2">
          <h3 className="font-semibold">備註</h3>
          <p className="text-sm text-muted-foreground">{order.note}</p>
        </div>
      )}
    </div>
  );
}

// getPaymentMethodLabel is now imported from @/lib/utils/pos-helpers
