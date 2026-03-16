import { z } from 'zod';

export const purchaseItemSchema = z.object({
  product_id: z.string().optional(),
  product_code: z.string().optional(),
  product_name: z.string().min(1, '請填寫品名'),
  unit_name: z.string().optional(),
  qty: z.coerce.number().min(0.01, '數量需大於 0'),
  unit_price: z.coerce.number().min(0),
  subtotal: z.coerce.number().optional(),
});

export const purchaseOrderSchema = z.object({
  vendor_id: z.string().optional(),
  receive_day: z.string().optional(),
  depot_id: z.string().optional(),
  tax_type: z.string().default('稅內含'),
  taxrate: z.coerce.number().default(0.05),
  note: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, '至少需要一筆明細'),
});

export type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
export type PurchaseItemFormValues = z.infer<typeof purchaseItemSchema>;
