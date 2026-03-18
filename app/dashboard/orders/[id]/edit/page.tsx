import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { fetchCustomerOrderById } from '@/app/actions/customer-orders';
import { OrderForm } from '@/components/orders/OrderForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditOrderPage({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { id } = await params;
  const order = await fetchCustomerOrderById(id);
  if (!order) notFound();

  const items = (order.items ?? []) as {
    product_id?: string;
    product_code?: string;
    product_name: string;
    unit_name?: string;
    qty: number;
    unit_price: number;
    discount_pct?: number;
    note?: string;
  }[];

  const defaultValues = {
    order_code: order.order_code,
    advance_date: order.advance_date ?? '',
    undertaker: order.undertaker ?? '',
    member_id: order.member_id ?? '',
    currency: order.currency ?? '台幣',
    tax_type: order.tax_type ?? '稅內含',
    taxrate: Number(order.taxrate) ?? 0.05,
    status: (order.status as string) ?? 'pending',
    sales_channel: order.sales_channel ?? '零售',
    note: order.note ?? '',
    items: items.map((row) => ({
      product_id: row.product_id ?? '',
      product_code: row.product_code ?? '',
      product_name: row.product_name,
      unit_name: row.unit_name ?? '',
      qty: Number(row.qty),
      unit_price: Number(row.unit_price),
      discount_pct: Number(row.discount_pct) ?? 100,
      note: row.note ?? '',
      cancelled: false,
    })),
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href={`/dashboard/orders/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回訂單
      </Link>
      <h1 className="text-2xl font-bold mb-6">編輯訂單</h1>
      <OrderForm
        mode="edit"
        orderId={id}
        initialOrderCode={order.order_code}
        defaultValues={defaultValues}
      />
    </div>
  );
}
