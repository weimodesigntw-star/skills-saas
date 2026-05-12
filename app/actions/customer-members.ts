'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { MemberFormValues } from '@/lib/schemas/member';
import { getAuthAndWorkspace } from '@/lib/workspace';

export interface CustomerMember {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  note: string | null;
  total_spent: number;
  visit_count: number;
  order_count?: number;
  created_at: string;
  updated_at: string;
  // ERP 欄位
  client_code: string | null;
  uniform_num: string | null;
  currency: string | null;
  tax_type: string | null;
  taxrate: number | null;
  prepaid: number | null;
  client_cat: string | null;
}

const MEMBER_SORT_COLUMNS = ['created_at', 'name', 'total_spent', 'order_count'] as const;
export type MemberSortColumn = (typeof MEMBER_SORT_COLUMNS)[number];

export async function fetchMembers(params: {
  search?: string;
  page?: number;
  pageSize?: number;
  /** S-001：排序欄位 */
  sortBy?: string;
  /** asc | desc */
  sortDir?: string;
}) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { members: [], total: 0, page: 1, pageSize: 20 };

  const { search, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;

  const sortBy = MEMBER_SORT_COLUMNS.includes(params.sortBy as MemberSortColumn)
    ? (params.sortBy as MemberSortColumn)
    : 'created_at';
  const ascending = params.sortDir === 'asc';

  let query = supabase
    .from('members')
    .select('*', { count: 'exact' })
    .eq('user_id', ownerId)
    .order(sortBy, { ascending })
    .range(from, from + pageSize - 1);

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`);
  }

  const { data, count, error } = await query;
  if (error) return { members: [], total: 0, page, pageSize };

  return {
    members: (data ?? []) as CustomerMember[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function fetchMemberById(id: string): Promise<CustomerMember | null> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;

  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  return (data as CustomerMember) ?? null;
}

/** INT-007：會員的客戶訂單（customer_orders），供詳細頁歷史與連結 */
export async function fetchMemberOrders(memberId: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return [];

  const { data } = await supabase
    .from('customer_orders')
    .select('id, order_code, total, status, advance_date, created_at')
    .eq('user_id', ownerId)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    order_number: (row.order_code as string) ?? '',
    total_amount: Number((row as { total?: number }).total ?? 0),
    status: (row.status as string) ?? '—',
    created_at: ((row as { advance_date?: string | null }).advance_date ??
      (row.created_at as string)) as string,
  }));
}

export async function createMember(values: MemberFormValues): Promise<{ success?: true; error?: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { error } = await supabase.from('members').insert({
    user_id: ownerId,
    name: values.name,
    phone: values.phone?.trim() || null,
    email: values.email?.trim() || null,
    birthday: values.birthday?.trim() || null,
    note: values.note?.trim() || null,
    client_code: values.client_code?.trim() || null,
    uniform_num: values.uniform_num?.trim() || null,
    currency: values.currency?.trim() || '台幣',
    tax_type: values.tax_type?.trim() || null,
    taxrate: values.taxrate ?? 0.05,
    prepaid: values.prepaid ?? 0,
    client_cat: values.client_cat?.trim() || null,
  });

  if (error) return { error: '新增失敗，請稍後再試' };
  revalidatePath('/dashboard/members');
  return { success: true };
}

export async function updateMember(id: string, values: MemberFormValues): Promise<{ success?: true; error?: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { error } = await supabase
    .from('members')
    .update({
      name: values.name,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      birthday: values.birthday?.trim() || null,
      note: values.note?.trim() || null,
      client_code: values.client_code?.trim() || null,
      uniform_num: values.uniform_num?.trim() || null,
      currency: values.currency?.trim() || '台幣',
      tax_type: values.tax_type?.trim() || null,
      taxrate: values.taxrate ?? 0.05,
      prepaid: values.prepaid ?? 0,
      client_cat: values.client_cat?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { error: '更新失敗，請稍後再試' };
  revalidatePath('/dashboard/members');
  revalidatePath(`/dashboard/members/${id}`);
  return { success: true };
}

export async function deleteMember(id: string): Promise<{ success?: true; error?: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { error: '刪除失敗，請稍後再試' };
  revalidatePath('/dashboard/members');
  return { success: true };
}
