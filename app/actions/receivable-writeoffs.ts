'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ReceivableWriteoffFormValues } from '@/lib/schemas/receivable-writeoff';

/** 沖帳列表列（含首筆明細單號：出貨單號或訂單號，存於 ship_code 欄） */
export type WriteoffListRow = {
  id: string;
  writeoff_code: string;
  writeoff_date: string;
  member_id: string | null;
  total_charge: number;
  discount: number;
  actual_recd: number;
  note: string | null;
  members: { id: string; name: string; client_code: string | null } | null;
  source_doc: string | null;
  created_at?: string;
};

const WRITEOFF_SORT_COLUMNS = [
  'writeoff_code',
  'writeoff_date',
  'total_charge',
  'discount',
  'actual_recd',
  'created_at',
] as const;

export async function fetchWriteoffs(params?: {
  memberId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  /** S-006 */
  sortBy?: string;
  sortDir?: string;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { writeoffs: [], total: 0, page: 1, pageSize: 20 };

  const { memberId, dateFrom, dateTo, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  const sortCol = WRITEOFF_SORT_COLUMNS.includes(params?.sortBy as (typeof WRITEOFF_SORT_COLUMNS)[number])
    ? (params!.sortBy as (typeof WRITEOFF_SORT_COLUMNS)[number])
    : 'created_at';
  const ascending = params?.sortDir === 'asc';

  let query = supabase
    .from('receivable_writeoffs')
    .select('*, members(id, name, client_code), receivable_writeoff_items(ship_code, customer_order_id)', {
      count: 'exact',
    })
    .eq('user_id', user.id)
    .order(sortCol, { ascending })
    .range(from, from + pageSize - 1);

  if (memberId) query = query.eq('member_id', memberId);
  if (dateFrom) query = query.gte('writeoff_date', dateFrom);
  if (dateTo) query = query.lte('writeoff_date', dateTo);

  const { data, count, error } = await query;
  if (error) return { writeoffs: [], total: 0, page, pageSize };

  const writeoffs: WriteoffListRow[] = (data ?? []).map((raw) => {
    const w = raw as {
      id: string;
      writeoff_code: string;
      writeoff_date: string;
      member_id: string | null;
      total_charge: number;
      discount: number;
      actual_recd: number;
      note: string | null;
      created_at?: string;
      members: { id: string; name: string; client_code: string | null } | null;
      receivable_writeoff_items?: { ship_code?: string | null }[];
    };
    const items = w.receivable_writeoff_items ?? [];
    const first = items[0];
    return {
      id: w.id,
      writeoff_code: w.writeoff_code,
      writeoff_date: w.writeoff_date,
      member_id: w.member_id,
      total_charge: Number(w.total_charge),
      discount: Number(w.discount),
      actual_recd: Number(w.actual_recd),
      note: w.note,
      members: w.members,
      source_doc: first?.ship_code ?? null,
      created_at: w.created_at,
    };
  });

  return { writeoffs, total: count ?? 0, page, pageSize };
}

export async function fetchWriteoffById(id: string) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/** 待收客戶訂單（total - amt_recd > 0） */
export async function fetchPendingCustomerOrdersByMember(memberId: string) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('customer_orders')
    .select('id, order_code, advance_date, total, amt_recd')
    .eq('user_id', user.id)
    .eq('member_id', memberId)
    .neq('status', 'cancelled')
    .order('advance_date', { ascending: false });

  if (error) return [];

  return (data ?? [])
    .map((row) => {
      const total = Number(row.total ?? 0);
      const recd = Number((row as { amt_recd?: number }).amt_recd ?? 0);
      const out = Math.max(0, total - recd);
      return {
        id: row.id as string,
        order_code: String(row.order_code ?? ''),
        ship_date: (row.advance_date as string | null) ?? null,
        total,
        amt_recd: recd,
        amt_outstanding: out,
      };
    })
    .filter((r) => r.amt_outstanding > 0);
}

export async function createWriteoff(values: ReceivableWriteoffFormValues) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const p_items = values.items.map((i) => {
    if (i.customer_order_id && String(i.customer_order_id).trim()) {
      return { customer_order_id: i.customer_order_id, writeoff_amount: i.writeoff_amount };
    }
    return { shipment_id: i.shipment_id, writeoff_amount: i.writeoff_amount };
  });

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
  revalidatePath('/dashboard/orders');
  return { success: true, writeoffId: result.writeoff_id, writeoffCode: result.writeoff_code };
}

export async function deleteWriteoff(id: string) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    .select('shipment_id, customer_order_id, writeoff_amount')
    .eq('writeoff_id', id);

  for (const item of items ?? []) {
    const amt = Number(item.writeoff_amount);
    const coId = (item as { customer_order_id?: string | null }).customer_order_id;
    if (coId) {
      const { data: co } = await supabase
        .from('customer_orders')
        .select('amt_recd')
        .eq('id', coId)
        .single();
      if (co) {
        const newRecd = Math.max(0, Number((co as { amt_recd?: number }).amt_recd ?? 0) - amt);
        await supabase.from('customer_orders').update({ amt_recd: newRecd }).eq('id', coId);
      }
    } else if (item.shipment_id) {
      const { data: ship } = await supabase
        .from('shipments')
        .select('amt_recd, amt_outstanding')
        .eq('id', item.shipment_id)
        .single();
      if (ship) {
        const newRecd = Math.max(0, Number(ship.amt_recd) - amt);
        const newOut = Number(ship.amt_outstanding) + amt;
        await supabase
          .from('shipments')
          .update({ amt_recd: newRecd, amt_outstanding: newOut })
          .eq('id', item.shipment_id);
      }
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
  revalidatePath('/dashboard/orders');
  return { success: true };
}
