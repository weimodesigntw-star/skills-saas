'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PayableWriteoffFormValues } from '@/lib/schemas/payable-writeoff';
import { getAuthAndWorkspace } from '@/lib/workspace';

export async function fetchPayableWriteoffs(params?: {
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { writeoffs: [], total: 0, page: 1, pageSize: 20 };

  const { vendorId, dateFrom, dateTo, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('payable_writeoffs')
    .select('*, vendors(id, vendor_code, vendor_name)', { count: 'exact' })
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (vendorId) query = query.eq('vendor_id', vendorId);
  if (dateFrom) query = query.gte('writeoff_date', dateFrom);
  if (dateTo) query = query.lte('writeoff_date', dateTo);

  const { data, count, error } = await query;
  if (error) return { writeoffs: [], total: 0, page, pageSize };
  return { writeoffs: data ?? [], total: count ?? 0, page, pageSize };
}

export async function fetchPayableWriteoffById(id: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;

  const { data: writeoff, error } = await supabase
    .from('payable_writeoffs')
    .select('*, vendors(id, vendor_code, vendor_name)')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  if (error || !writeoff) return null;

  const { data: items } = await supabase
    .from('payable_writeoff_items')
    .select('*')
    .eq('writeoff_id', id)
    .order('created_at');

  return { ...writeoff, items: items ?? [] };
}

export async function fetchPendingPurchasesByVendor(vendorId: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return [];

  const { data } = await supabase
    .from('purchase_orders')
    .select('id, receive_code, receive_day, total, amt_paid, amt_unpaid')
    .eq('user_id', ownerId)
    .eq('vendor_id', vendorId)
    .eq('status', 'valid')
    .gt('amt_unpaid', 0)
    .order('receive_day', { ascending: false });

  return (data ?? []) as {
    id: string;
    receive_code: string;
    receive_day: string | null;
    total: number;
    amt_paid: number;
    amt_unpaid: number;
  }[];
}

export async function createPayableWriteoff(values: PayableWriteoffFormValues) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const p_items = values.items.map((i) => ({
    purchase_id: i.purchase_id,
    writeoff_amount: i.writeoff_amount,
  }));

  const { data, error } = await supabase.rpc('execute_payable_writeoff', {
    p_user_id: ownerId,
    p_vendor_id: values.vendor_id,
    p_writeoff_date: values.writeoff_date,
    p_items,
    p_discount: values.discount ?? 0,
    p_note: values.note?.trim() || null,
  });

  if (error) return { error: error.message || '沖帳失敗' };
  const result = data as { writeoff_id: string; writeoff_code: string } | null;
  if (!result) return { error: '沖帳失敗' };

  revalidatePath('/dashboard/payables');
  revalidatePath(`/dashboard/payables/${result.writeoff_id}`);
  revalidatePath('/dashboard/purchases');
  return { success: true, writeoffId: result.writeoff_id, writeoffCode: result.writeoff_code };
}
