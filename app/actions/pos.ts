/**
 * POS Server Actions
 *
 * 處理 POS 模組的伺服器端操作：
 * - 獲取商品清單
 * - 獲取分類
 * - 建立訂單
 * - 獲取訂單歷史
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { Product, Order, OrderItem } from '@/lib/types/pos';

/**
 * 獲取 POS 商品列表
 *
 * @param categoryId 分類 ID (可選)
 * @param search 搜尋文本 (商品名稱或條碼)
 * @param limit 返回數量限制
 * @returns 商品列表
 */
export async function fetchPosProducts(
  categoryId?: string,
  search?: string,
  limit = 100
): Promise<Product[]> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  let query = supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  // 按分類篩選
  if (categoryId && categoryId !== 'all') {
    query = query.eq('category_id', categoryId);
  }

  // 按搜尋文本篩選
  if (search && search.trim()) {
    const searchTerm = search.trim();
    // 使用 ilike 進行不區分大小寫的搜尋（名稱或條碼）
    query = query.or(`name.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return (data || []) as Product[];
}

/**
 * 獲取 POS 商品分類
 *
 * @returns 分類列表
 */
export async function fetchPosCategories() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }

  // 只返回根級分類（parent_id 為 null）
  return ((data || []).filter(cat => cat.parent_id === null)) as Array<{
    id: string;
    name: string;
    parent_id: string | null;
  }>;
}

/**
 * 獲取單一商品詳情（用於掃碼搜尋）
 *
 * @param barcode 商品條碼
 * @returns 商品詳情或 null
 */
export async function fetchProductByBarcode(barcode: string): Promise<Product | null> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id)
    .eq('barcode', barcode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch product: ${error.message}`);
  }

  return (data as Product) || null;
}

interface CreateOrderItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

/**
 * 建立 POS 訂單
 *
 * 透過 Supabase RPC 函數 `create_pos_order` 建立訂單，確保交易安全
 *
 * @param paymentMethod 付款方式 (cash / credit_card / line_pay / easy_card)
 * @param items 訂單項目
 * @param discountAmount 折扣金額 (可選)
 * @param note 訂單備註 (可選)
 * @returns 訂單 ID
 */
export async function createPosOrder(
  paymentMethod: string,
  items: CreateOrderItem[],
  discountAmount = 0,
  note?: string
): Promise<string> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  if (!items || items.length === 0) {
    throw new Error('購物車不能為空');
  }

  // 呼叫 RPC 函數
  const { data, error } = await supabase.rpc('create_pos_order', {
    p_user_id: user.id,
    p_payment_method: paymentMethod,
    p_items: JSON.stringify(items),
    p_discount_amount: discountAmount,
    p_note: note || null,
  });

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  if (!data) {
    throw new Error('Failed to create order: no order ID returned');
  }

  return data as string;
}

/**
 * 獲取訂單列表
 *
 * @param page 頁碼 (從 0 開始)
 * @param pageSize 每頁數量
 * @param status 訂單狀態 (可選)
 * @returns 訂單列表與分頁資訊
 */
export async function getOrders(
  page = 0,
  pageSize = 20,
  status?: string
): Promise<{ orders: Order[]; total: number }> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, count, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return {
    orders: (data || []) as Order[],
    total: count || 0,
  };
}

/**
 * 獲取訂單詳情
 *
 * @param orderId 訂單 ID
 * @returns 訂單詳情與明細項目
 */
export async function getOrderDetail(
  orderId: string
): Promise<{ order: Order; items: OrderItem[] } | null> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // 獲取訂單
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (orderError) {
    throw new Error(`Failed to fetch order: ${orderError.message}`);
  }

  if (!orderData) {
    return null;
  }

  // 獲取訂單明細
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to fetch order items: ${itemsError.message}`);
  }

  return {
    order: orderData as Order,
    items: (itemsData || []) as OrderItem[],
  };
}
