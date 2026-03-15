'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { MemberFormValues } from '@/lib/schemas/member';

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
  created_at: string;
  updated_at: string;
}

export async function fetchMembers(params: {
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { members: [], total: 0, page: 1, pageSize: 20 };

  const { search, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('members')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  return (data as CustomerMember) ?? null;
}

export async function fetchMemberOrders(memberId: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('orders')
    .select('id, order_number, total_amount, status, created_at')
    .eq('user_id', user.id)
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []) as { id: string; order_number: string; total_amount: number; status: string; created_at: string }[];
}

export async function createMember(values: MemberFormValues): Promise<{ success?: true; error?: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { error } = await supabase.from('members').insert({
    user_id: user.id,
    name: values.name,
    phone: values.phone?.trim() || null,
    email: values.email?.trim() || null,
    birthday: values.birthday?.trim() || null,
    note: values.note?.trim() || null,
  });

  if (error) return { error: '新增失敗，請稍後再試' };
  revalidatePath('/dashboard/members');
  return { success: true };
}

export async function updateMember(id: string, values: MemberFormValues): Promise<{ success?: true; error?: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { error } = await supabase
    .from('members')
    .update({
      name: values.name,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      birthday: values.birthday?.trim() || null,
      note: values.note?.trim() || null,
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { error: '更新失敗，請稍後再試' };
  revalidatePath('/dashboard/members');
  revalidatePath(`/dashboard/members/${id}`);
  return { success: true };
}

export async function deleteMember(id: string): Promise<{ success?: true; error?: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { error: '刪除失敗，請稍後再試' };
  revalidatePath('/dashboard/members');
  return { success: true };
}
