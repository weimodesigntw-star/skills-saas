import { getOrderCodePreview, fetchCustomerOrderById } from '@/app/actions/customer-orders';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewOrderForm } from './NewOrderForm';
import type { CustomerOrderFormValues } from '@/lib/schemas/customer-order';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: { cloneFrom?: string };
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const orderCodePreview = await getOrderCodePreview();
  const cloneFrom = searchParams.cloneFrom;

  let cloneDefaults: Partial<CustomerOrderFormValues> | undefined;
  if (cloneFrom) {
    const order = await fetchCustomerOrderById(cloneFrom);
    if (order) {
      const today = new Date().toISOString().slice(0, 10);
      const o = order as Record<string, unknown>;
      const rawItems = (order.items ?? []) as Record<string, unknown>[];
      const items = rawItems.map((it) => ({
        product_id: (it.product_id as string | undefined) ?? undefined,
        product_code: (it.product_code as string) ?? '',
        product_name: String(it.product_name ?? ''),
        unit_name: (it.unit_name as string) ?? '',
        qty: Number(it.qty) || 0,
        shipped_qty: 0,
        unit_price: Number(it.unit_price) || 0,
        discount_pct: Number(it.discount_pct ?? 100),
        cancelled: false,
      }));
      cloneDefaults = {
        member_id: (o.member_id as string) ?? '',
        advance_date: today,
        note: '',
        sales_channel: (o.sales_channel as string) ?? '零售',
        tax_type: (o.tax_type as string) ?? '稅內含',
        taxrate: Number(o.taxrate ?? 0.05),
        undertaker: (o.undertaker as string) ?? '',
        currency: (o.currency as string) ?? '台幣',
        status: 'pending',
        items: items.length
          ? items
          : [
              {
                product_name: '',
                unit_name: '',
                qty: 1,
                shipped_qty: 0,
                unit_price: 0,
                discount_pct: 100,
                cancelled: false,
              },
            ],
      };
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{cloneFrom ? '複製訂單' : '新增客戶訂單'}</h1>
      <NewOrderForm orderCodePreview={orderCodePreview ?? ''} cloneDefaults={cloneDefaults} />
    </div>
  );
}
