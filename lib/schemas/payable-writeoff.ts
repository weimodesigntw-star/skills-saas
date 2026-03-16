import { z } from 'zod';

export const payableWriteoffItemSchema = z.object({
  purchase_id: z.string().min(1),
  receive_code: z.string(),
  charge_amount: z.coerce.number(),
  writeoff_amount: z.coerce.number().min(0),
});

export const payableWriteoffSchema = z.object({
  writeoff_date: z.string().min(1, '請選擇付款日期'),
  vendor_id: z.string().min(1, '請選擇廠商'),
  discount: z.coerce.number().min(0).default(0),
  note: z.string().optional(),
  items: z.array(payableWriteoffItemSchema).min(1, '至少選取一張採購單'),
});

export type PayableWriteoffFormValues = z.infer<typeof payableWriteoffSchema>;
export type PayableWriteoffItemFormValues = z.infer<typeof payableWriteoffItemSchema>;
