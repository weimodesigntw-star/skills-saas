'use client';

import { useMemo } from 'react';
import { OrderForm } from '@/components/orders/OrderForm';
import type { CustomerOrderFormValues } from '@/lib/schemas/customer-order';

interface NewOrderFormProps {
  orderCodePreview: string;
  /** O-006：由 ?cloneFrom= 帶入 */
  cloneDefaults?: Partial<CustomerOrderFormValues>;
}

const emptyLine = {
  product_name: '',
  unit_name: '',
  qty: 1,
  shipped_qty: 0,
  unit_price: 0,
  discount_pct: 100,
  cancelled: false,
};

export function NewOrderForm({ orderCodePreview, cloneDefaults }: NewOrderFormProps) {
  const defaultValues = useMemo((): Partial<CustomerOrderFormValues> => {
    if (cloneDefaults?.items?.length) {
      return {
        ...cloneDefaults,
        order_code: orderCodePreview,
        items: cloneDefaults.items,
        note: '',
      };
    }
    return {
      order_code: orderCodePreview,
      items: [emptyLine],
    };
  }, [orderCodePreview, cloneDefaults]);

  return <OrderForm mode="new" defaultValues={defaultValues} />;
}
