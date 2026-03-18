'use client';

import { OrderForm } from '@/components/orders/OrderForm';

interface NewOrderFormProps {
  orderCodePreview: string;
}

export function NewOrderForm({ orderCodePreview }: NewOrderFormProps) {
  return (
    <OrderForm
      mode="new"
      defaultValues={{
        order_code: orderCodePreview,
        items: [{ product_name: '', unit_name: '', qty: 1, shipped_qty: 0, unit_price: 0, discount_pct: 100, cancelled: false }],
      }}
    />
  );
}
