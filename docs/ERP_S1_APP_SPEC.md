# S1 應用層｜完整可執行規格

> 給小龍蝦直接接手用。DB 已跑完 025～028，本文件為應用層實作規格。

---

## 實作順序建議

1. **depots.ts**（最簡單，後面商品表單要用）
2. **vendors 相關**：schema → actions → 廠商列表頁 + VendorsClient + VendorDialog
3. **Sidebar** 加廠商管理
4. **商品表單** 補 5 欄（需 getVendors、getDepots）
5. **會員表單** 補 7 欄 + member schema

---

## 1. `app/actions/depots.ts`（新建）

```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'

export async function getDepots() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data } = await supabase
    .from('depots')
    .select('id, depot_code, depot_name')
    .eq('user_id', user.id)
    .order('depot_code')
  return data ?? []
}

export async function createDepot(values: { depot_code?: string; depot_name: string; note?: string }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '請先登入' }
  const { error } = await supabase.from('depots').insert({ user_id: user.id, ...values })
  if (error) return { error: '新增失敗' }
  return { success: true }
}
```

- 供商品表單「倉庫」下拉使用；若 S1 不做倉庫管理 CRUD 頁，至少要有 `getDepots()`。

---

## 2. `lib/schemas/vendor.ts`（新建）

```typescript
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
```

---

## 3. `app/actions/vendors.ts`（新建）

```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { VendorFormValues } from '@/lib/schemas/vendor'

export async function fetchVendors(params?: { search?: string; page?: number; pageSize?: number }) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { vendors: [], total: 0, page: 1, pageSize: 20 }

  const { search, page = 1, pageSize = 20 } = params ?? {}
  const from = (page - 1) * pageSize

  let query = supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('vendor_code', { ascending: true })
    .range(from, from + pageSize - 1)

  if (search?.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(`vendor_name.ilike.${term},vendor_code.ilike.${term}`)
  }

  const { data, count } = await query
  return { vendors: data ?? [], total: count ?? 0, page, pageSize }
}

export async function fetchVendorById(id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('vendors').select('*').eq('id', id).eq('user_id', user.id).single()
  return data ?? null
}

export async function createVendor(values: VendorFormValues) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '請先登入' }
  const { error } = await supabase.from('vendors').insert({ user_id: user.id, ...values })
  if (error) return { error: '新增失敗' }
  revalidatePath('/dashboard/vendors')
  return { success: true }
}

export async function updateVendor(id: string, values: VendorFormValues) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '請先登入' }
  const { error } = await supabase.from('vendors').update(values).eq('id', id).eq('user_id', user.id)
  if (error) return { error: '更新失敗' }
  revalidatePath('/dashboard/vendors')
  return { success: true }
}

export async function deleteVendor(id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '請先登入' }
  const { error } = await supabase.from('vendors').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { error: '刪除失敗，可能已被商品引用' }
  revalidatePath('/dashboard/vendors')
  return { success: true }
}
```

---

## 4. 廠商管理頁面

### 4.1 `app/dashboard/vendors/page.tsx`（Server Component）

```tsx
import { fetchVendors } from '@/app/actions/vendors'
import { VendorsClient } from './VendorsClient'

export default async function VendorsPage({
  searchParams
}: { searchParams: Promise<{ search?: string; page?: string }> }) {
  const resolved = await searchParams
  const page = Number(resolved.page ?? 1)
  const { vendors, total, pageSize } = await fetchVendors({
    search: resolved.search,
    page
  })
  return (
    <VendorsClient
      initialVendors={vendors}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  )
}
```

- 若專案中 `searchParams` 仍為同步物件，改為 `searchParams: { search?: string; page?: string }` 並直接使用。

### 4.2 `app/dashboard/vendors/VendorsClient.tsx`（Client）

- **列表欄位**：廠商代碼、廠商名稱、統一編號、電話、幣別、稅率、操作（編輯 / 刪除）
- **上方**：搜尋列 +「新增廠商」按鈕
- **新增 / 編輯**：同一個 `VendorDialog`（open 時傳 `vendorId?: string`，有則為編輯）
- **刪除**：用現有 `ConfirmDialog` 或 `components/ui` 確認框
- **空狀態**：用 `EmptyState`
- **分頁**：每頁 20 筆，與 `fetchVendors` 的 page/pageSize 一致

### 4.3 `components/vendors/VendorDialog.tsx`

表單欄位（對照 ERP）：

| 欄位 | name | 型態 | 必填 |
|------|------|------|------|
| 廠商代碼 | vendor_code | Input | ✅ |
| 廠商名稱 | vendor_name | Input | ✅ |
| 廠商類別 | vendor_cat | Input | — |
| 統一編號 | uniform_num | Input | — |
| 幣別 | currency | Select（台幣 / 美元 / 日幣） | — |
| 稅別 | tax_type | Select（稅內含 / 稅外加 / 免稅） | — |
| 稅率 | taxrate | Input number（預設 0.05） | — |
| 聯絡人 | contact | Input | — |
| 電話 | phone | Input | — |
| Email | email | Input | — |
| 備註 | note | Textarea | — |

- 使用 `vendorSchema` + `react-hook-form` + `zodResolver`，與現有會員/商品表單風格一致。
- 提交時呼叫 `createVendor` 或 `updateVendor`，成功後關閉 Dialog 並重新拉列表（或 revalidate）。

---

## 5. 商品表單補欄位

- **檔案**：`app/dashboard/products/new/page.tsx`、`app/dashboard/products/[id]/page.tsx`
- **現況**：表單與 schema 在各自頁面內（`ProductFormSchema`），無獨立 `ProductForm.tsx`。

**新增「ERP 資訊」區塊（可摺疊）：**

| 欄位 | name | 型態 | 說明 |
|------|------|------|------|
| 商品代碼 | product_code | Input | 選填 |
| 批發價 | whole_sell_price | Input number | 預設 0 |
| 採購單價 | purchase_price | Input number | 預設 0 |
| 廠商 | vendor_id | Select | 選單來自 `fetchVendors` 或 getVendors（僅 id, vendor_code, vendor_name） |
| 倉庫 | depot_id | Select | 選單來自 `getDepots()` |

- **Server Action**：`app/actions/products.ts` 的 `createProduct`、`updateProduct` 從 FormData 讀取上述 5 個欄位並寫入 `products` 表。
- **Schema**：在各自頁面的 `ProductFormSchema` 加上對應欄位（選填、數字 ≥ 0）。
- 商品列表不需顯示這 5 欄，僅表單與後端寫入需支援。

---

## 6. 會員表單補欄位

- **檔案**：`components/members/MemberDialog.tsx` 或會員編輯表單所在處；`app/actions/customer-members.ts`；`lib/schemas/member.ts`。

**新增「ERP 資訊」區塊：**

| 欄位 | name | 型態 | 說明 |
|------|------|------|------|
| 客戶代碼 | client_code | Input | 選填 |
| 統一編號 | uniform_num | Input | 選填 |
| 客戶類別 | client_cat | Input | 選填 |
| 幣別 | currency | Select | 台幣 / 美元 等，預設台幣 |
| 稅別 | tax_type | Select | 稅內含 / 稅外加 / 免稅 |
| 稅率 | taxrate | Input number | 預設 0.05 |
| 預付款 | prepaid | Input number | 預設 0 |

- **`lib/schemas/member.ts`**：在 `memberSchema` 加上上述 7 個欄位（z.coerce.number() 等，選填或給 default）。
- **`app/actions/customer-members.ts`**：`createMember`、`updateMember` 的 insert/update 物件加入這 7 個欄位。

---

## 7. Sidebar 新增「廠商管理」

**檔案**：`components/layout/Sidebar.tsx`

在 `navItems` 適當位置（建議「會員管理」下方）加入：

```tsx
{ href: '/dashboard/vendors', label: '廠商管理', icon: Building2 }
```

- 從 `lucide-react` 引入 `Building2`。

---

## 8. 驗收清單

```
□ getDepots() 可正常回傳
□ /dashboard/vendors 可新增廠商
□ /dashboard/vendors 列表正確顯示，搜尋有效
□ 廠商編輯、刪除正常
□ 商品新增/編輯頁出現 5 個新欄位，廠商/倉庫下拉有資料
□ 會員新增/編輯頁出現 7 個新欄位
□ Sidebar 廠商管理連結正確
□ 全部 build 通過，push 後 Vercel 部署成功
```

---

## 9. 注意事項

- **searchParams**：Next.js 15 起 `searchParams` 可能為 Promise，需 `await searchParams`；若專案仍為同步則直接使用。
- **廠商刪除**：若有商品引用 `vendor_id`，DB 為 ON DELETE SET NULL，刪除廠商不會失敗；若希望「有引用不給刪」，需在 `deleteVendor` 前查 `products` 是否有該 `vendor_id`。
- **倉庫**：S1 若不做倉庫 CRUD，僅需 `getDepots()`；可先手動在 Supabase 插一筆「總倉」供商品表單選用。

S1 完成後即可進 **S2（客戶訂單）**。
