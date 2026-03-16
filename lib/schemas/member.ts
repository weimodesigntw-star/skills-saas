import { z } from 'zod';

export const memberSchema = z.object({
  name: z.string().min(1, '請填寫姓名'),
  phone: z
    .string()
    .regex(/^09\d{8}$/, '請填寫有效手機號碼（09 開頭 10 碼）')
    .optional()
    .or(z.literal('')),
  email: z
    .string()
    .email('請填寫有效 Email')
    .optional()
    .or(z.literal('')),
  birthday: z.string().optional(),
  note: z.string().optional(),
  // ERP 欄位（S1 會員補欄）
  client_code: z.string().optional(),
  uniform_num: z.string().optional(),
  currency: z.string().default('台幣'),
  tax_type: z.string().optional(),
  taxrate: z.coerce.number().min(0).max(1).default(0.05),
  prepaid: z.coerce.number().min(0).default(0),
  client_cat: z.string().optional(),
});

export type MemberFormValues = z.infer<typeof memberSchema>;
