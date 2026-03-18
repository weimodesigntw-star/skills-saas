import { z } from 'zod';

export const orderItemSchema = z.object({
  id: z.string().optional(),
  product_id: z.string().optional(),
  product_code: z.string().optional(),
  product_name: z.string().min(1, '請填寫品名'),
  unit_name: z.string().optional(),
  qty: z.coerce.number().min(0.01, '數量需大於 0'),
  shipped_qty: z.coerce.number().min(0).default(0),
  unit_price: z.coerce.number().min(0, '單價不可為負'),
  discount_pct: z.coerce.number().min(0).max(100).default(100),
  subtotal: z.coerce.number().optional(),
  note: z.string().optional(),
  cancelled: z.boolean().default(false),
});

export const customerOrderSchema = z.object({
  order_code: z.string().optional(),
  advance_date: z.string().optional(),
  undertaker: z.string().optional(),
  member_id: z.string().optional(),
  currency: z.string().default('台幣'),
  tax_type: z.string().default('稅內含'),
  taxrate: z.coerce.number().default(0.05),
  status: z.string().default('pending'),
  sales_channel: z.string().default('零售'),
  note: z.string().optional(),
  items: z.array(orderItemSchema).min(1, '至少需要一筆明細'),
});

export type CustomerOrderFormValues = z.infer<typeof customerOrderSchema>;
export type OrderItemFormValues = z.infer<typeof orderItemSchema>;
