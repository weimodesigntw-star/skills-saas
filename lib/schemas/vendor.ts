import { z } from 'zod'

export const vendorSchema = z.object({
  vendor_code: z.string().min(1, '請填寫廠商代碼'),
  vendor_name: z.string().min(1, '請填寫廠商名稱'),
  vendor_cat:  z.string().optional(),
  uniform_num: z.string().optional(),
  currency:    z.string().default('台幣'),
  tax_type:    z.string().optional(),
  taxrate:     z.coerce.number().min(0).max(1).default(0.05),
  contact:     z.string().optional(),
  phone:       z.string().optional(),
  email:       z.string().email().optional().or(z.literal('')),
  note:        z.string().optional(),
})

export type VendorFormValues = z.infer<typeof vendorSchema>