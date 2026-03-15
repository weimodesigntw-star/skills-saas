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