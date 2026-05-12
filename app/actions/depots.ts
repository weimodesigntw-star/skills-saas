'use server'
import { createServerClient } from '@/lib/supabase/server'
import { getAuthAndWorkspace } from '@/lib/workspace'

export async function getDepots() {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return []
  const { data } = await supabase
    .from('depots')
    .select('id, depot_code, depot_name')
    .eq('user_id', ownerId)
    .order('depot_code')
  return data ?? []
}

export async function createDepot(values: { depot_code?: string; depot_name: string; note?: string }) {
  const supabase = createServerClient()
  const { ownerId } = await getAuthAndWorkspace(supabase)
  if (!ownerId) return { error: '請先登入' }
  const { error } = await supabase.from('depots').insert({ user_id: ownerId, ...values })
  if (error) return { error: '新增失敗' }
  return { success: true }
}