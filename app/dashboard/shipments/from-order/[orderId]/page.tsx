import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { fetchCustomerOrderById } from '@/app/actions/customer-orders';
import { FromOrderShipmentForm } from '@/components/shipments/FromOrderShipmentForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function FromOrderShipmentPage({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { orderId } = await params;
  const order = await fetchCustomerOrderById(orderId);
  if (!order) notFound();
  if (order.status !== 'pending') {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <p className="text-muted-foreground">此訂單已出貨或已取消，無法轉出貨單。</p>
        <Link href={`/dashboard/orders/${orderId}`} className="text-primary underline mt-2 inline-block">
          返回訂單
        </Link>
      </div>
    );
  }

  const items = (order.items ?? []) as {
    id: string;
    product_id: string | null;
    product_code: string | null;
    product_name: string;
    unit_name: string | null;
    qty: number;
    shipped_qty: number;
    unit_price: number;
    subtotal?: number;
  }[];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href={`/dashboard/orders/${orderId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回訂單
      </Link>
      <h1 className="text-2xl font-bold mb-6">從訂單轉出貨單</h1>
      <FromOrderShipmentForm
        order={{
          id: order.id,
          order_code: order.order_code,
          taxrate: Number(order.taxrate) ?? 0.05,
          tax_type: (order.tax_type as string) ?? '稅內含',
          items,
        }}
      />
    </div>
  );
}
