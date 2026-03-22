'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import type { CustomerOrderFormValues } from '@/lib/schemas/customer-order';

/** INT-006：依 customer_orders 重算單一會員 total_spent / order_count（RLS 下使用） */
async function refreshMemberStats(memberId: string | null, supabase: SupabaseClient) {
  if (!memberId) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: orders, error } = await supabase
    .from('customer_orders')
    .select('total')
    .eq('user_id', user.id)
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
    .eq('user_id', user.id)
    .eq('id', memberId);

  if (updErr && isMissingOrderCountColumn(updErr)) {
    ({ error: updErr } = await supabase
      .from('members')
      .update({
        total_spent: Number(total.toFixed(2)),
        visit_count: count,
      })
      .eq('user_id', user.id)
      .eq('id', memberId));
  }
}

export async function getOrderCodePreview(): Promise<string | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('generate_order_code', {
    p_user_id: user.id,
    p_prefix: 'BA201',
  });
  if (error || data == null) return null;
  return typeof data === 'string' ? data : String(data);
}

export async function fetchCustomerOrders(params?: {
  q?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orders: [], total: 0, page: 1, pageSize: 20 };

  const { q, status, dateFrom, dateTo, memberId, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('customer_orders')
    .select(
      `
      *,
      members(id, name, client_code)
    `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
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
        .eq('user_id', user.id)
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: order, error: orderError } = await supabase
    .from('customer_orders')
    .select('*, members(id, name, client_code)')
    .eq('id', id)
    .eq('user_id', user.id)
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { error } = await supabase
    .from('customer_orders')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { error: '更新失敗' };
  revalidatePath('/dashboard/orders');
  return { success: true };
}

export async function updateCustomerOrderItemShippedQty(itemId: string, shippedQty: number) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

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
    .eq('user_id', user.id)
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
    const { error: rpcErr } = await supabase.rpc('adjust_stock', {
      p_product_id: pid,
      p_user_id: user.id,
      p_type: 'loss',
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { data: codeData, error: codeError } = await supabase.rpc('generate_order_code', {
    p_user_id: user.id,
    p_prefix: 'BA201',
  });
  if (codeError || codeData == null) return { error: '產生訂單號失敗' };
  const orderCode = typeof codeData === 'string' ? codeData : String(codeData);

  const { subtotal, tax_amount, total } = calcTotals(values);

  const { data: order, error: orderError } = await supabase
    .from('customer_orders')
    .insert({
      user_id: user.id,
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

  await refreshMemberStats(values.member_id || null, supabase);

  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard/members');
  return { success: true, orderId: order.id, orderCode };
}

export async function updateCustomerOrder(id: string, values: CustomerOrderFormValues) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { data: existing } = await supabase
    .from('customer_orders')
    .select('member_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  const prevMemberId = (existing as { member_id?: string | null } | null)?.member_id ?? null;

  const { subtotal, tax_amount, total } = calcTotals(values);

  const { error: updateError } = await supabase
    .from('customer_orders')
    .update({
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
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) return { error: '更新訂單失敗' };

  await supabase.from('customer_order_items').delete().eq('order_id', id);
  const itemsToInsert = values.items.map((item) => ({
    order_id: id,
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

  if (itemsError) return { error: '更新明細失敗' };

  await refreshMemberStats(prevMemberId, supabase);
  await refreshMemberStats(values.member_id || null, supabase);

  revalidatePath('/dashboard/orders');
  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath('/dashboard/members');
  return { success: true };
}

export async function deleteCustomerOrder(id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { data: existing } = await supabase
    .from('customer_orders')
    .select('member_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  const memberId = (existing as { member_id?: string | null } | null)?.member_id ?? null;

  const { error } = await supabase
    .from('customer_orders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { error: '刪除失敗' };

  await refreshMemberStats(memberId, supabase);

  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard/members');
  return { success: true };
}
