'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { VendorFormValues } from '@/lib/schemas/vendor'
import { getAuthAndWorkspace } from '@/lib/workspace'

export async function fetchVendors(params?: { search?: string; page?: number; pageSize?: number }) {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return { vendors: [], total: 0, page: 1, pageSize: 20 }

  const { search, page = 1, pageSize = 20 } = params ?? {}
  const from = (page - 1) * pageSize

  let query = supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .eq('user_id', ownerId)
    .order('vendor_code', { ascending: true })
    .range(from, from + pageSize - 1)

  if (search?.trim()) {
    const term = `%${search.trim()}%`
    query = query.or(`vendor_name.ilike.${term},vendor_code.ilike.${term}`)
  }

  const { data, count } = await query
  return { vendors: data ?? [], total: count ?? 0, page, pageSize }
}

export async function getVendors() {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return []
  const { data } = await supabase
    .from('vendors')
    .select('id, vendor_code, vendor_name')
    .eq('user_id', ownerId)
    .order('vendor_code')
  return data ?? []
}

export async function fetchVendorById(id: string) {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return null
  const { data } = await supabase.from('vendors').select('*').eq('id', id).eq('user_id', ownerId).single()
  return data ?? null
}

export async function createVendor(values: VendorFormValues) {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return { error: '請先登入' }
  const { error } = await supabase.from('vendors').insert({ user_id: ownerId, ...values })
  if (error) return { error: '新增失敗' }
  revalidatePath('/dashboard/vendors')
  return { success: true }
}

export async function updateVendor(id: string, values: VendorFormValues) {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return { error: '請先登入' }
  const { error } = await supabase.from('vendors').update(values).eq('id', id).eq('user_id', ownerId)
  if (error) return { error: '更新失敗' }
  revalidatePath('/dashboard/vendors')
  return { success: true }
}

export async function deleteVendor(id: string) {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return { error: '請先登入' }
  const { error } = await supabase.from('vendors').delete().eq('id', id).eq('user_id', ownerId)
  if (error) return { error: '刪除失敗，可能已被商品引用' }
  revalidatePath('/dashboard/vendors')
  return { success: true }
}