'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { CustomerOrderFormValues } from '@/lib/schemas/customer-order';
import { getAuthAndWorkspace } from '@/lib/workspace';

/** INT-006：依 customer_orders 重算單一會員 total_spent / order_count（RLS 下使用） */
async function refreshMemberStats(memberId: string | null, supabase: SupabaseClient) {
  if (!memberId) return;

  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return;

  const { data: orders, error } = await supabase
    .from('customer_orders')
    .select('total')
    .eq('user_id', ownerId)
    .eq('member_id', memberId);

  if (error) {
    console.error('[refreshMemberStats]', error);
    return;
  }

  const list = orders ?? [];
  const total = list.reduce((s, o) => s + Number((o as { total?: number }).total ?? 0), 0);
  const count = list.length;

  const isMissingOrderCountColumn = (err: unknown) => {
    const message = String((err as { message?: string })?.message ?? '').toLowerCase();
    return message.includes('order_count') && message.includes('column');
  };

  let { error: updErr } = await supabase
    .from('members')
    .update({
      total_spent: Number(total.toFixed(2)),
      order_count: count,
      visit_count: count,
    })
    .eq('user_id', ownerId)
    .eq('id', memberId);

  if (updErr && isMissingOrderCountColumn(updErr)) {
    ({ error: updErr } = await supabase
      .from('members')
      .update({
        total_spent: Number(total.toFixed(2)),
        visit_count: count,
      })
      .eq('user_id', ownerId)
      .eq('id', memberId));
  }
}

type ReserveItem = {
  product_id: string | null;
  qty: number;
  shipped_qty?: number | null;
  product_name?: string | null;
};

async function runAdjustInventory(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  type: 'reserve' | 'release' | 'ship',
  qty: number,
  note: string
) {
  const amount = Math.max(0, Math.floor(Number(qty) || 0));
  if (amount <= 0) return { ok: true as const };
  const { error } = await supabase.rpc('adjust_inventory', {
    p_product_id: productId,
    p_user_id: userId,
    p_type: type,
    p_qty: amount,
    p_note: note,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

async function applyReserveForItems(
  supabase: SupabaseClient,
  userId: string,
  items: ReserveItem[],
  note: string
) {
  for (const item of items) {
    if (!item.product_id) continue;
    const qty = Math.max(0, Number(item.qty) - Math.max(0, Number(item.shipped_qty ?? 0)));
    const res = await runAdjustInventory(supabase, userId, item.product_id, 'reserve', qty, note);
    if (!res.ok) return res;
  }
  return { ok: true as const };
}

async function applyReleaseForItems(
  supabase: SupabaseClient,
  userId: string,
  items: ReserveItem[],
  note: string
) {
  for (const item of items) {
    if (!item.product_id) continue;
    const qty = Math.max(0, Number(item.qty) - Math.max(0, Number(item.shipped_qty ?? 0)));
    const res = await runAdjustInventory(supabase, userId, item.product_id, 'release', qty, note);
    if (!res.ok) return res;
  }
  return { ok: true as const };
}

export async function getOrderCodePreview(): Promise<string | null> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;
  const { data, error } = await supabase.rpc('generate_order_code', {
    p_user_id: ownerId,
    p_prefix: 'BA201',
  });
  if (error || data == null) return null;
  return typeof data === 'string' ? data : String(data);
}

const ORDER_SORT_COLUMNS = ['created_at', 'advance_date', 'total', 'order_code'] as const;
export type CustomerOrderSortColumn = (typeof ORDER_SORT_COLUMNS)[number];

export async function fetchCustomerOrders(params?: {
  q?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
  page?: number;
  pageSize?: number;
  /** S-002：排序欄位 */
  sortBy?: string;
  sortDir?: string;
}) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { orders: [], total: 0, page: 1, pageSize: 20 };

  const { q, status, dateFrom, dateTo, memberId, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  const sortBy = ORDER_SORT_COLUMNS.includes(params?.sortBy as CustomerOrderSortColumn)
    ? (params!.sortBy as CustomerOrderSortColumn)
    : 'created_at';
  const ascending = params?.sortDir === 'asc';

  let query = supabase
    .from('customer_orders')
    .select(
      `
      *,
      members(id, name, client_code)
    `,
      { count: 'exact' }
    )
    .eq('user_id', ownerId)
    .order(sortBy, { ascending })
    .range(from, from + pageSize - 1);

  if (q?.trim()) {
    const term = q.trim();

    const isNumeric = /^\d+$/.test(term);
    const isDateLike = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(term);

    if (isDateLike) {
      // 日期格式：2020-03 / 2020/03 / 2020-03-15 / 2020/03/15
      const normalized = term.replace(/\//g, '-');
      const parts = normalized.split('-').filter(Boolean);
      const yyyy = Number(parts[0]);
      const mm = parts.length >= 2 ? Number(parts[1]) : NaN;
      const dd = parts.length >= 3 ? Number(parts[2]) : NaN;

      if (Number.isFinite(yyyy) && Number.isFinite(mm) && mm >= 1 && mm <= 12) {
        if (Number.isFinite(dd) && dd >= 1 && dd <= 31) {
          const d = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
          query = query.eq('advance_date', d);
        } else {
          const start = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-01`;
          const end = new Date(yyyy, mm, 0); // mm is 1-based here
          const endStr = `${String(end.getFullYear()).padStart(4, '0')}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(
            end.getDate()
          ).padStart(2, '0')}`;
          query = query.gte('advance_date', start).lte('advance_date', endStr);
        }
      }
    } else if (isNumeric) {
      // 純數字 → 訂單號
      query = query.ilike('order_code', `%${term}%`);
    } else {
      // 其他：走 members.name
      const { data: matchedMembers, error: memberErr } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', ownerId)
        .ilike('name', `%${term}%`)
        .limit(2000);

      if (memberErr) return { orders: [], total: 0, page, pageSize };

      const ids = (matchedMembers ?? []).map((m) => m.id);
      if (ids.length === 0) return { orders: [], total: 0, page, pageSize };

      // Supabase/PostgREST 對 in() 參數數量有限制，分批 OR 起來
      const CHUNK = 200;
      const parts: string[] = [];
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        parts.push(`member_id.in.(${chunk.join(',')})`);
      }
      query = query.or(parts.join(','));
    }
  }

  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('advance_date', dateFrom);
  if (dateTo) query = query.lte('advance_date', dateTo);
  if (memberId) query = query.eq('member_id', memberId);

  const { data, count, error } = await query;
  if (error) return { orders: [], total: 0, page, pageSize };
  return { orders: data ?? [], total: count ?? 0, page, pageSize };
}

export async function fetchCustomerOrderById(id: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;

  const { data: order, error: orderError } = await supabase
    .from('customer_orders')
    .select('*, members(id, name, client_code)')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  if (orderError || !order) return null;

  const { data: items } = await supabase
    .from('customer_order_items')
    .select('*')
    .eq('order_id', id)
    .order('created_at');

  return { ...order, items: items ?? [] };
}

export async function updateCustomerOrderStatus(id: string, status: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: order, error: orderErr } = await supabase
    .from('customer_orders')
    .select('id, order_code, status')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle();
  if (orderErr || !order) return { error: '找不到訂單' };

  const prevStatus = String((order as { status?: string }).status ?? '').toLowerCase();
  const nextStatus = String(status ?? '').toLowerCase();

  if (nextStatus === 'cancelled' && prevStatus !== 'cancelled') {
    const { data: items } = await supabase
      .from('customer_order_items')
      .select('product_id, qty, shipped_qty')
      .eq('order_id', id);
    const releaseRes = await applyReleaseForItems(
      supabase,
      ownerId,
      (items ?? []) as ReserveItem[],
      `訂單取消釋放保留（${(order as { order_code?: string }).order_code ?? id}）`
    );
    if (!releaseRes.ok) return { error: releaseRes.error || '釋放保留庫存失敗' };
  }

  const { error } = await supabase
    .from('customer_orders')
    .update({ status })
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { error: '更新失敗' };
  revalidatePath('/dashboard/orders');
  return { success: true };
}

export async function updateCustomerOrderItemShippedQty(itemId: string, shippedQty: number) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: item, error: itemErr } = await supabase
    .from('customer_order_items')
    .select('id, order_id, qty, shipped_qty, product_id')
    .eq('id', itemId)
    .maybeSingle();

  if (itemErr || !item) return { error: '找不到明細' };

  const { data: order, error: orderErr } = await supabase
    .from('customer_orders')
    .select('id, order_code')
    .eq('id', item.order_id)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (orderErr || !order) return { error: '無權限' };

  const maxQty = Number(item.qty) || 0;
  const prevShipped = Math.max(0, Number((item as { shipped_qty?: number }).shipped_qty ?? 0));
  const next = Math.max(0, Math.min(Number(shippedQty) || 0, maxQty));
  const delta = next - prevShipped;

  const { error: updateErr } = await supabase
    .from('customer_order_items')
    .update({ shipped_qty: next })
    .eq('id', itemId);

  if (updateErr) return { error: '更新失敗' };

  // INT-003：本次出貨增量扣庫存（有綁 product_id 時）
  if (delta > 0 && (item as { product_id?: string | null }).product_id) {
    const pid = (item as { product_id: string }).product_id;
    const orderCode = (order as { order_code?: string }).order_code ?? '';
    const { error: rpcErr } = await supabase.rpc('adjust_inventory', {
      p_product_id: pid,
      p_user_id: ownerId,
      p_type: 'ship',
      p_qty: Math.floor(delta),
      p_note: `客戶訂單出貨${orderCode ? `（${orderCode}）` : ''}`,
    });
    if (rpcErr) {
      await supabase.from('customer_order_items').update({ shipped_qty: prevShipped }).eq('id', itemId);
      return { error: rpcErr.message || '庫存扣減失敗，已還原出貨數量' };
    }
    revalidatePath('/dashboard/inventory');
    revalidatePath('/dashboard/pos/inventory');
  }

  revalidatePath(`/dashboard/orders/${order.id}`);
  return { success: true, shipped_qty: next };
}

function calcItemSubtotal(item: {
  qty: number;
  unit_price: number;
  discount_pct: number;
}) {
  return +(item.qty * item.unit_price * (item.discount_pct / 100)).toFixed(2);
}

function calcTotals(values: CustomerOrderFormValues) {
  const subtotal = +values.items
    .filter((i) => !i.cancelled)
    .reduce((s, i) => s + calcItemSubtotal(i), 0)
    .toFixed(2);

  let tax_amount = 0;
  let total = subtotal;
  if (values.tax_type === '稅內含') {
    tax_amount = +(subtotal * (values.taxrate / (1 + values.taxrate))).toFixed(2);
    total = subtotal;
  } else if (values.tax_type === '稅外加') {
    tax_amount = +(subtotal * values.taxrate).toFixed(2);
    total = +(subtotal + tax_amount).toFixed(2);
  }
  return { subtotal, tax_amount, total };
}

export async function createCustomerOrder(values: CustomerOrderFormValues) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: codeData, error: codeError } = await supabase.rpc('generate_order_code', {
    p_user_id: ownerId,
    p_prefix: 'BA201',
  });
  if (codeError || codeData == null) return { error: '產生訂單號失敗' };
  const orderCode = typeof codeData === 'string' ? codeData : String(codeData);

  const { subtotal, tax_amount, total } = calcTotals(values);

  const { data: order, error: orderError } = await supabase
    .from('customer_orders')
    .insert({
      user_id: ownerId,
      order_code: orderCode,
      advance_date: values.advance_date || null,
      undertaker: values.undertaker?.trim() || null,
      member_id: values.member_id || null,
      currency: values.currency,
      tax_type: values.tax_type,
      taxrate: values.taxrate,
      subtotal,
      tax_amount,
      total,
      sales_channel: values.sales_channel,
      note: values.note?.trim() || null,
      status: values.status ?? 'pending',
    })
    .select('id')
    .single();

  if (orderError || !order) return { error: '建立訂單失敗' };

  const itemsToInsert = values.items.map((item) => ({
    order_id: order.id,
    product_id: item.product_id || null,
    product_code: item.product_code || null,
    product_name: item.product_name,
    unit_name: item.unit_name || null,
    qty: item.qty,
    shipped_qty: item.shipped_qty ?? 0,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct,
    subtotal: calcItemSubtotal(item),
    note: item.note?.trim() || null,
  }));

  const { error: itemsError } = await supabase
    .from('customer_order_items')
    .insert(itemsToInsert);

  if (itemsError) return { error: '建立明細失敗' };

  const reserveRes = await applyReserveForItems(
    supabase,
    ownerId,
    itemsToInsert,
    `新建訂單保留庫存（${orderCode}）`
  );
  if (!reserveRes.ok) {
    await supabase.from('customer_orders').delete().eq('id', order.id).eq('user_id', ownerId);
    return { error: reserveRes.error || '保留庫存失敗，已回滾訂單' };
  }

  await refreshMemberStats(values.member_id || null, supabase);

  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard/members');
  return { success: true, orderId: order.id, orderCode };
}

export async function updateCustomerOrder(id: string, values: CustomerOrderFormValues) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { subtotal, tax_amount, total } = calcTotals(values);
  const itemsToInsert = values.items.map((item) => ({
    product_id: item.product_id || null,
    product_code: item.product_code || null,
    product_name: item.product_name,
    unit_name: item.unit_name || null,
    qty: item.qty,
    shipped_qty: item.shipped_qty ?? 0,
    unit_price: item.unit_price,
    discount_pct: item.discount_pct,
    subtotal: calcItemSubtotal(item),
    note: item.note?.trim() || null,
  }));
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('update_customer_order_atomic', {
    p_user_id: ownerId,
    p_order_id: id,
    p_advance_date: values.advance_date || null,
    p_undertaker: values.undertaker?.trim() || null,
    p_member_id: values.member_id || null,
    p_currency: values.currency,
    p_tax_type: values.tax_type,
    p_taxrate: values.taxrate,
    p_subtotal: subtotal,
    p_tax_amount: tax_amount,
    p_total: total,
    p_sales_channel: values.sales_channel,
    p_note: values.note?.trim() || null,
    p_status: values.status ?? 'pending',
    p_items: itemsToInsert,
  });
  if (rpcErr) return { error: rpcErr.message || '更新訂單失敗' };

  const prevMemberId = ((rpcRes as { prev_member_id?: string | null } | null)?.prev_member_id ?? null) as string | null;
  const nextMemberId = ((rpcRes as { member_id?: string | null } | null)?.member_id ?? values.member_id ?? null) as string | null;
  await refreshMemberStats(prevMemberId, supabase);
  await refreshMemberStats(nextMemberId, supabase);

  revalidatePath('/dashboard/orders');
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath('/dashboard/inventory');
  revalidatePath('/dashboard/pos/inventory');
  revalidatePath('/dashboard/members');
  return { success: true };
}

export async function deleteCustomerOrder(id: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: existing } = await supabase
    .from('customer_orders')
    .select('member_id, order_code')
    .eq('id', id)
    .eq('user_id', ownerId)
    .maybeSingle();
  const memberId = (existing as { member_id?: string | null } | null)?.member_id ?? null;
  const orderCode = (existing as { order_code?: string | null } | null)?.order_code ?? id;

  const { data: items } = await supabase
    .from('customer_order_items')
    .select('product_id, qty, shipped_qty')
    .eq('order_id', id);
  const releaseRes = await applyReleaseForItems(
    supabase,
    ownerId,
    (items ?? []) as ReserveItem[],
    `刪除訂單釋放保留（${orderCode}）`
  );
  if (!releaseRes.ok) return { error: releaseRes.error || '釋放保留庫存失敗' };

  const { error } = await supabase
    .from('customer_orders')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { error: '刪除失敗' };

  await refreshMemberStats(memberId, supabase);

  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard/members');
  return { success: true };
}
