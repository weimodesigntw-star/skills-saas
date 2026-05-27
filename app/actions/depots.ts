'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

export async function getDepots() {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return [];

  const { data } = await supabase
    .from('depots')
    .select('id, depot_code, depot_name')
    .eq('user_id', ownerId)
    .order('depot_code');

  return data ?? [];
}

export async function createDepot(values: { depot_code?: string; depot_name: string; note?: string }) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const depotName = values.depot_name?.trim();
  if (!depotName) return { error: '請輸入倉庫名稱' };

  const { error } = await supabase.from('depots').insert({
    user_id: ownerId,
    depot_code: values.depot_code?.trim() || null,
    depot_name: depotName,
    note: values.note?.trim() || null,
  });

  if (error) return { error: error.message || '建立倉庫失敗' };

  revalidatePath('/dashboard/inventory');
  revalidatePath('/dashboard/products');
  return { success: true };
}
