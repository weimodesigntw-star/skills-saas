'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { CustomerOrderFormValues } from '@/lib/schemas/customer-order';

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
  search?: string;
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

  const { search, status, dateFrom, dateTo, memberId, page = 1, pageSize = 20 } = params ?? {};
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

  if (search?.trim()) {
    query = query.ilike('order_code', `%${search.trim()}%`);
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
      status: 'pending',
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
    unit_price: item.unit_price,
    discount_pct: item.discount_pct,
    subtotal: calcItemSubtotal(item),
    note: item.note?.trim() || null,
  }));

  const { error: itemsError } = await supabase
    .from('customer_order_items')
    .insert(itemsToInsert);

  if (itemsError) return { error: '建立明細失敗' };

  revalidatePath('/dashboard/orders');
  return { success: true, orderId: order.id, orderCode };
}

export async function updateCustomerOrder(id: string, values: CustomerOrderFormValues) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

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
    unit_price: item.unit_price,
    discount_pct: item.discount_pct,
    subtotal: calcItemSubtotal(item),
    note: item.note?.trim() || null,
  }));
  const { error: itemsError } = await supabase
    .from('customer_order_items')
    .insert(itemsToInsert);

  if (itemsError) return { error: '更新明細失敗' };

  revalidatePath('/dashboard/orders');
  revalidatePath(`/dashboard/orders/${id}`);
  return { success: true };
}

export async function deleteCustomerOrder(id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { error } = await supabase
    .from('customer_orders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return { error: '刪除失敗' };
  revalidatePath('/dashboard/orders');
  return { success: true };
}
