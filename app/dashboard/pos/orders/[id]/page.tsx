'use client';

/**
 * 訂單詳情頁
 * - 訂單標題（狀態、付款方式）
 * - 發票：開立 / 發票號碼 + 重印
 * - 明細表格、小計稅額總計
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNTD } from '@/lib/constants';
import { fetchOrderById } from '@/app/actions/pos';
import { getInvoiceByOrderId, issueInvoice } from '@/app/actions/invoices';
import type { Order, OrderItem } from '@/lib/types/pos';
import { toast } from '@/components/ui/toast';
import { ArrowLeft, Receipt, Printer } from 'lucide-react';

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

const STATUS_LABELS: Record<string, string> = {
  pending: '待處理',
  paid: '已付款',
  refunded: '已退款',
  voided: '已作廢',
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [invoice, setInvoice] = useState<{ id: string; invoice_number: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [issueLoading, setIssueLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      const data = await fetchOrderById(id);
      if (cancelled) return;
      if (data) {
        setOrder(data.order);
        setItems(data.items);
        const inv = await getInvoiceByOrderId(id);
        if (!cancelled && inv) setInvoice({ id: inv.id, invoice_number: inv.invoice_number });
        else if (!cancelled) setInvoice(null);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleIssueInvoice = async () => {
    if (!id) return;
    setIssueLoading(true);
    const result = await issueInvoice(id);
    setIssueLoading(false);
    if ('error' in result) {
      if (result.error === 'NO_ACTIVE_TRACK') {
        toast.error('請先至「字軌設定」啟用一組字軌後再開立發票');
      } else {
        toast.error(result.error);
      }
      return;
    }
    toast.success(`發票已開立：${result.invoice.invoice_number}`);
    if (result.warning) toast.info(result.warning);
    setInvoice({ id: result.invoice.id, invoice_number: result.invoice.invoice_number });
  };

  if (!id) return null;

  if (loading) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="container mx-auto py-6 px-4">
        <Link href="/dashboard/pos/orders">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回訂單列表
          </Button>
        </Link>
        <p className="text-muted-foreground">找不到此訂單。</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <Link href="/dashboard/pos/orders">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回訂單列表
        </Button>
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">訂單 {order.order_number}</CardTitle>
          <Badge variant={statusVariant(order.status)}>
            {STATUS_LABELS[order.status] ?? order.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">建立時間</span>
              <p>{new Date(order.created_at).toLocaleString('zh-TW')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">付款方式</span>
              <p>{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</p>
            </div>
            {order.note && (
              <div className="col-span-2">
                <span className="text-muted-foreground">備註</span>
                <p>{order.note}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg">發票</CardTitle>
          {invoice ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">發票號碼</span>
              <span className="font-mono font-medium">{invoice.invoice_number}</span>
              <Link href="/dashboard/pos/invoices">
                <Button variant="outline" size="sm">
                  <Printer className="h-4 w-4 mr-1" />
                  重印
                </Button>
              </Link>
            </div>
          ) : (
            <Button size="sm" onClick={handleIssueInvoice} disabled={issueLoading}>
              <Receipt className="h-4 w-4 mr-1" />
              {issueLoading ? '開立中…' : '開立發票'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {invoice ? (
            <p className="text-sm text-muted-foreground">此訂單已開立發票，可至發票管理重印。</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              尚未開立發票。開立前請先至「字軌設定」啟用一組字軌。
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>訂單明細</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">商品</th>
                  <th className="text-right p-3 font-medium">單價</th>
                  <th className="text-right p-3 font-medium">數量</th>
                  <th className="text-right p-3 font-medium">小計</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">{item.product_name}</td>
                    <td className="p-3 text-right">{formatNTD(item.unit_price)}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                    <td className="p-3 text-right">{formatNTD(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <dl className="w-56 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">小計</dt>
                <dd>{formatNTD(Number(order.subtotal))}</dd>
              </div>
              {Number(order.tax_amount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">稅額</dt>
                  <dd>{formatNTD(Number(order.tax_amount))}</dd>
                </div>
              )}
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">折扣</dt>
                  <dd>-{formatNTD(Number(order.discount_amount))}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-medium">
                <dt>總計</dt>
                <dd>{formatNTD(Number(order.total_amount))}</dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
