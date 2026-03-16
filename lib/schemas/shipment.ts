import { z } from 'zod';

export const shipmentItemSchema = z.object({
  order_item_id: z.string().optional(),
  product_id: z.string().optional(),
  product_code: z.string().optional(),
  product_name: z.string().min(1, '請填寫品名'),
  unit_name: z.string().optional(),
  qty: z.coerce.number().min(0.01, '數量需大於 0'),
  unit_price: z.coerce.number().min(0),
  subtotal: z.coerce.number().optional(),
});

export const shipmentSchema = z.object({
  ship_date: z.string().optional(),
  source_order_id: z.string().optional(),
  depot_id: z.string().optional(),
  note: z.string().optional(),
  items: z.array(shipmentItemSchema).min(1, '至少需要一筆明細'),
});

export const receivePaymentSchema = z.object({
  amt: z.coerce.number().min(0.01, '收款金額需大於 0'),
  note: z.string().optional(),
});

export type ShipmentFormValues = z.infer<typeof shipmentSchema>;
export type ShipmentItemFormValues = z.infer<typeof shipmentItemSchema>;
export type ReceivePaymentFormValues = z.infer<typeof receivePaymentSchema>;
