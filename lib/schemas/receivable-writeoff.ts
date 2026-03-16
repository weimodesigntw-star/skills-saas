import { z } from 'zod';

export const writeoffItemSchema = z.object({
  shipment_id: z.string().min(1),
  ship_code: z.string(),
  charge_amount: z.coerce.number(),
  writeoff_amount: z.coerce.number().min(0, '沖帳金額不可為負'),
});

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
