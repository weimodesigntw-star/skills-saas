import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { fetchShipmentById } from '@/app/actions/shipments';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Truck } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { ShipmentDetailActions } from './ShipmentDetailActions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ShipmentDetailPage({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState icon={Truck} title="請先登入" description="登入後即可查看出貨單" />
      </div>
    );
  }

  const { id } = await params;
  const shipment = await fetchShipmentById(id);
  if (!shipment) notFound();

  const member = shipment.members as { id: string; name: string; client_code: string | null } | null;
  const customerLabel = member ? (member.client_code ? `${member.name}（${member.client_code}）` : member.name) : '—';

  const items = (shipment.items ?? []) as {
    product_name: string;
    unit_name: string | null;
    qty: number;
    unit_price: number;
    subtotal: number;
  }[];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/dashboard/shipments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回出貨單列表
      </Link>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-mono">{shipment.ship_code}</CardTitle>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>出貨日期：{shipment.ship_date ?? '—'}</p>
              <p>客戶：{customerLabel}</p>
              <p>來源訂單：{shipment.source_order_code ?? '—'}</p>
              <p>
                狀態：{' '}
                <span className={shipment.status === 'valid' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                  {shipment.status === 'valid' ? '有效' : '已作廢'}
                </span>
              </p>
              {shipment.note && <p>備註：{shipment.note}</p>}
            </div>
          </div>
          <ShipmentDetailActions shipment={shipment} />
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
            <p>小計：{formatNTD(Number(shipment.subtotal))}</p>
            <p>稅額：{formatNTD(Number(shipment.tax_amount))}</p>
            <p className="font-bold">合計：{formatNTD(Number(shipment.total))}</p>
            <p>已收：{formatNTD(Number(shipment.amt_recd))}</p>
            <p>未收：{formatNTD(Number(shipment.amt_outstanding))}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
