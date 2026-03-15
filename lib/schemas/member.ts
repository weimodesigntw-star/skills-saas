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
});

export type MemberFormValues = z.infer<typeof memberSchema>;
