import { z } from 'zod';

export const checkoutSchema = z.object({
  customerName: z.string().min(1, '請填寫姓名'),
  customerPhone: z.string().regex(/^09\d{8}$/, '請填寫有效手機號碼（09 開頭 10 碼）'),
  address: z.string().min(5, '請填寫完整地址'),
  note: z.string().optional(),
  paymentMethod: z.enum(['cash', 'credit_card', 'line_pay', 'easy_card'], {
    required_error: '請選擇付款方式',
  }),
});

export type CheckoutFormValues = z.infer<typeof checkoutSchema>;
