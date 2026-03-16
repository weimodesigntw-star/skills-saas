'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ReceivableWriteoffFormValues } from '@/lib/schemas/receivable-writeoff';

export async function fetchWriteoffs(params?: {
  memberId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { writeoffs: [], total: 0, page: 1, pageSize: 20 };

  const { memberId, dateFrom, dateTo, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('receivable_writeoffs')
    .select('*, members(id, name, client_code)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (memberId) query = query.eq('member_id', memberId);
  if (dateFrom) query = query.gte('writeoff_date', dateFrom);
  if (dateTo) query = query.lte('writeoff_date', dateTo);

  const { data, count, error } = await query;
  if (error) return { writeoffs: [], total: 0, page, pageSize };
  return { writeoffs: data ?? [], total: count ?? 0, page, pageSize };
}

export async function fetchWriteoffById(id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: writeoff, error: wError } = await supabase
    .from('receivable_writeoffs')
    .select('*, members(id, name, client_code)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (wError || !writeoff) return null;

  const { data: items } = await supabase
    .from('receivable_writeoff_items')
    .select('*')
    .eq('writeoff_id', id)
    .order('created_at');

  return { ...writeoff, items: items ?? [] };
}

export async function fetchPendingShipmentsByMember(memberId: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('shipments')
    .select('id, ship_code, ship_date, total, amt_recd, amt_outstanding')
    .eq('user_id', user.id)
    .eq('member_id', memberId)
    .eq('status', 'valid')
    .gt('amt_outstanding', 0)
    .order('ship_date', { ascending: false });

  return (data ?? []) as {
    id: string;
    ship_code: string;
    ship_date: string | null;
    total: number;
    amt_recd: number;
    amt_outstanding: number;
  }[];
}

export async function createWriteoff(values: ReceivableWriteoffFormValues) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const p_items = values.items.map((i) => ({
    shipment_id: i.shipment_id,
    writeoff_amount: i.writeoff_amount,
  }));

  const { data, error } = await supabase.rpc('execute_receivable_writeoff', {
    p_user_id: user.id,
    p_member_id: values.member_id,
    p_writeoff_date: values.writeoff_date,
    p_items,
    p_discount: values.discount ?? 0,
    p_prepaid_used: values.prepaid_used ?? 0,
    p_note: values.note?.trim() || null,
  });

  if (error) return { error: error.message || '沖帳失敗' };
  const result = data as { writeoff_id: string; writeoff_code: string } | null;
  if (!result) return { error: '沖帳失敗' };

  revalidatePath('/dashboard/receivables');
  revalidatePath(`/dashboard/receivables/${result.writeoff_id}`);
  revalidatePath('/dashboard/shipments');
  return { success: true, writeoffId: result.writeoff_id, writeoffCode: result.writeoff_code };
}

export async function deleteWriteoff(id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { data: writeoff, error: fetchError } = await supabase
    .from('receivable_writeoffs')
    .select('id, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !writeoff) return { error: '找不到沖帳單' };

  const created = new Date(writeoff.created_at);
  const today = new Date();
  if (
    created.getUTCFullYear() !== today.getUTCFullYear() ||
    created.getUTCMonth() !== today.getUTCMonth() ||
    created.getUTCDate() !== today.getUTCDate()
  ) {
    return { error: '僅可刪除當日建立的沖帳單' };
  }

  const { data: items } = await supabase
    .from('receivable_writeoff_items')
    .select('shipment_id, writeoff_amount')
    .eq('writeoff_id', id);

  for (const item of items ?? []) {
    const { data: ship } = await supabase
      .from('shipments')
      .select('amt_recd, amt_outstanding')
      .eq('id', item.shipment_id)
      .single();
    if (ship) {
      const amt = Number(item.writeoff_amount);
      const newRecd = Math.max(0, Number(ship.amt_recd) - amt);
      const newOut = Number(ship.amt_outstanding) + amt;
      await supabase
        .from('shipments')
        .update({ amt_recd: newRecd, amt_outstanding: newOut })
        .eq('id', item.shipment_id);
    }
  }

  const { error: deleteError } = await supabase
    .from('receivable_writeoffs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (deleteError) return { error: '刪除失敗' };
  revalidatePath('/dashboard/receivables');
  revalidatePath('/dashboard/shipments');
  return { success: true };
}
