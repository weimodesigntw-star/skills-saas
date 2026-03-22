import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, DollarSign, Ban } from 'lucide-react';
import { fetchPurchaseOrderById } from '@/app/actions/purchase-orders';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { PurchaseDetailActions } from './PurchaseDetailActions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PurchaseDetailPage({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState icon={ShoppingCart} title="請先登入" description="登入後即可查看採購單" />
      </div>
    );
  }

  const { id } = await params;
  const purchase = await fetchPurchaseOrderById(id);
  if (!purchase) notFound();

  const vendorLabel = purchase.vendor_name ?? (purchase.vendors as any)?.vendor_name ?? '—';
  const items = (purchase.items ?? []) as {
    product_name: string;
    unit_name: string | null;
    qty: number;
    unit_price: number;
    subtotal: number;
  }[];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/dashboard/purchases"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回採購單列表
      </Link>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-mono">{purchase.receive_code}</CardTitle>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>進貨日期：{purchase.receive_day ?? '—'}</p>
              <p>廠商：{vendorLabel}</p>
              <p>
                狀態：{' '}
                <span className={purchase.status === 'valid' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {purchase.status === 'valid' ? '有效' : '已作廢'}
                </span>
              </p>
              {purchase.note && <p>備註：{purchase.note}</p>}
            </div>
          </div>
          <PurchaseDetailActions purchase={purchase} />
        </CardHeader>
        <CardContent className="border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">明細</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">品名</th>
                  <th className="text-left py-2 font-semibold">單位</th>
                  <th className="text-right py-2 font-semibold">數量</th>
                  <th className="text-right py-2 font-semibold">單價</th>
                  <th className="text-right py-2 font-semibold">小計</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2">{row.product_name}</td>
                    <td className="py-2 text-muted-foreground">{row.unit_name ?? '—'}</td>
                    <td className="py-2 text-right">{Number(row.qty)}</td>
                    <td className="py-2 text-right">{formatNTD(Number(row.unit_price))}</td>
                    <td className="py-2 text-right">{formatNTD(Number(row.subtotal))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-1 text-sm text-right">
            <p>小計：{formatNTD(Number(purchase.subtotal))}</p>
            <p>稅額：{formatNTD(Number(purchase.tax_amount))}</p>
            <p className="font-bold">合計：{formatNTD(Number(purchase.total))}</p>
            <p>已付：{formatNTD(Number(purchase.amt_paid))}</p>
            <p
              className={
                Number(purchase.amt_unpaid) > 0 ? 'text-orange-600 font-semibold' : undefined
              }
            >
              未付：{formatNTD(Number(purchase.amt_unpaid))}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
