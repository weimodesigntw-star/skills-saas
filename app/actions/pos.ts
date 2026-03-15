/**
 * POS Server Actions
 *
 * 處理 POS 模組的商品查詢、條碼掃描、訂單列表與詳情
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { Product, Order, OrderItem } from '@/lib/types/pos';

export type OrderStatus = 'pending' | 'paid' | 'refunded' | 'voided';

export interface FetchOrdersParams {
  status?: OrderStatus | '';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  page?: number;
  pageSize?: number;
}

export interface FetchOrdersResult {
  orders: Order[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 透過條碼查詢商品
 */
export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('barcode', barcode)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Product;
}

/**
 * 取得 POS 用的分類列表
 */
export async function fetchPosCategories(): Promise<{ id: string; name: string; parent_id: string | null }[]> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('categories').select('id, name, parent_id').eq('user_id', user.id).order('sort_order');
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, parent_id: r.parent_id ?? null }));
}

/**
 * 取得 POS 用的商品列表（僅啟用中的商品）
 */
export async function fetchPosProducts(categoryId?: string | null, search?: string): Promise<Product[]> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name')
    .limit(100);

  // 分類篩選
  if (categoryId && categoryId !== 'all') {
    query = query.eq('category_id', categoryId);
  }

  // 關鍵字搜尋（名稱或條碼）
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},barcode.ilike.${term}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch POS products:', error.message);
    return [];
  }

  return (data || []) as Product[];
}

/**
 * 取得訂單列表（含篩選、分頁）
 */
export async function fetchOrders(params: FetchOrdersParams = {}): Promise<FetchOrdersResult> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { orders: [], total: 0, page: 1, pageSize: 20 };

  const { status, dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }
  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59.999Z`);
  }

  const { data: orders, error, count } = await query.range(from, to);

  if (error) {
    console.error('Failed to fetch orders:', error.message);
    return { orders: [], total: 0, page, pageSize };
  }

  return {
    orders: (orders ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      user_id: row.user_id,
      order_number: row.order_number ?? row.order_no ?? '',
      status: row.status ?? 'pending',
      payment_method: row.payment_method ?? '',
      payment_reference: row.payment_reference ?? null,
      subtotal: Number(row.subtotal ?? row.amount ?? 0),
      tax_amount: Number(row.tax_amount ?? 0),
      discount_amount: Number(row.discount_amount ?? 0),
      total_amount: Number(row.total_amount ?? row.amount ?? 0),
      customer_name: row.customer_name ?? null,
      customer_phone: row.customer_phone ?? null,
      note: row.note ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    })) as Order[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * 取得單筆訂單詳情（含明細）
 */
export async function fetchOrderById(orderId: string): Promise<{ order: Order; items: OrderItem[] } | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .single();

  if (orderError || !orderRow) return null;

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');

  if (itemsError) return null;

  const order: Order = {
    id: orderRow.id,
    user_id: orderRow.user_id,
    order_number: orderRow.order_number ?? orderRow.order_no ?? '',
    status: orderRow.status ?? 'pending',
    payment_method: orderRow.payment_method ?? '',
    payment_reference: orderRow.payment_reference ?? null,
    subtotal: Number(orderRow.subtotal ?? orderRow.amount ?? 0),
    tax_amount: Number(orderRow.tax_amount ?? 0),
    discount_amount: Number(orderRow.discount_amount ?? 0),
    total_amount: Number(orderRow.total_amount ?? orderRow.amount ?? 0),
    customer_name: orderRow.customer_name ?? null,
    customer_phone: orderRow.customer_phone ?? null,
    note: orderRow.note ?? null,
    metadata: (orderRow.metadata as Record<string, unknown>) ?? null,
    created_at: orderRow.created_at,
    updated_at: orderRow.updated_at,
  };

  const orderItems: OrderItem[] = (items ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    order_id: String(row.order_id),
    product_id: row.product_id != null ? String(row.product_id) : null,
    product_name: String(row.product_name ?? ''),
    product_barcode: row.product_barcode != null ? String(row.product_barcode) : null,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    subtotal: Number(row.subtotal),
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    created_at: String(row.created_at),
  }));

  return { order, items: orderItems };
}

