import { z } from 'zod';

/** 單筆明細：出貨單或客戶訂單擇一 */
export const writeoffItemSchema = z
  .object({
    shipment_id: z.string().optional(),
    customer_order_id: z.string().optional(),
    ship_code: z.string().optional(),
    order_code: z.string().optional(),
    charge_amount: z.coerce.number().optional(),
    writeoff_amount: z.coerce.number().min(0, '沖帳金額不可為負'),
  })
  .refine(
    (d) =>
      (d.shipment_id != null && String(d.shipment_id).length > 0) ||
      (d.customer_order_id != null && String(d.customer_order_id).length > 0),
    { message: '請指定出貨單或客戶訂單' }
  );

export const receivableWriteoffSchema = z.object({
  writeoff_date: z.string().min(1, '請選擇沖帳日期'),
  member_id: z.string().min(1, '請選擇客戶'),
  discount: z.coerce.number().min(0).default(0),
  prepaid_used: z.coerce.number().min(0).default(0),
  note: z.string().optional(),
  items: z.array(writeoffItemSchema).min(1, '至少選取一張出貨單'),
});

export type ReceivableWriteoffFormValues = z.infer<typeof receivableWriteoffSchema>;
export type WriteoffItemFormValues = z.infer<typeof writeoffItemSchema>;
