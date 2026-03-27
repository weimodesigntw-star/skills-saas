/**
 * 庫存 Server Actions
 * 依賴 migration 018 stock_adjustments、050 adjust_inventory RPC
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_PAGE_SIZE = 20;

export type InventoryItem = {
  id: string;
  name: string;
  category_name: string | null;
  barcode: string | null;
  stock: number;
  is_low_stock: boolean;
};

const INVENTORY_SORT_COLUMNS = ['stock', 'name', 'barcode'] as const;

export type FetchInventoryParams = {
  categoryId?: string;
  lowStockOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
  /** S-004：未指定時預設依庫存由低到高 */
  sortBy?: string;
  sortDir?: string;
};

export type FetchInventoryResult = {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
};

export async function fetchInventory(
  params: FetchInventoryParams = {}
): Promise<FetchInventoryResult> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const { categoryId, lowStockOnly, search, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const explicitSort = INVENTORY_SORT_COLUMNS.includes(params.sortBy as (typeof INVENTORY_SORT_COLUMNS)[number]);
  const sortColumn = explicitSort ? (params.sortBy as (typeof INVENTORY_SORT_COLUMNS)[number]) : 'stock';
  const ascending = explicitSort ? params.sortDir !== 'desc' : true;

  let query = supabase
    .from('products')
    .select('id, name, category_id, barcode, stock, low_stock_threshold, categories(name)', {
      count: 'exact',
    })
    .eq('user_id', user.id)
    .order(sortColumn, { ascending });

  if (categoryId && categoryId !== 'all') {
    query = query.eq('category_id', categoryId);
  }
  if (lowStockOnly) {
    query = query.lte('stock', LOW_STOCK_THRESHOLD);
  }
  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},barcode.ilike.${term}`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('fetchInventory:', error.message);
    return { items: [], total: 0, page, pageSize };
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    name: string;
    category_id: string | null;
    barcode: string | null;
    stock: number;
    low_stock_threshold: number | null;
    categories: { name: string } | { name: string }[] | null;
  }[];

  const items: InventoryItem[] = rows.map((r) => {
    const threshold = r.low_stock_threshold ?? LOW_STOCK_THRESHOLD;
    const stock = Number(r.stock ?? 0);
    const cat = r.categories;
    const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
    return {
      id: r.id,
      name: r.name,
      category_name: categoryName ?? null,
      barcode: r.barcode ?? null,
      stock,
      is_low_stock: stock <= threshold,
    };
  });

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export type AdjustStockParams = {
  productId: string;
  type: 'restock' | 'loss' | 'manual';
  qty: number;
  note?: string;
};

/** 回傳調整後庫存，或 error */
export async function adjustStock(
  data: AdjustStockParams
): Promise<{ qtyAfter: number } | { error: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '未登入' };

  const { productId, type, qty, note } = data;
  if (!productId || !type) return { error: '缺少商品或類型' };
  if (type !== 'restock' && type !== 'loss' && type !== 'manual') return { error: '無效的調整類型' };
  const qtyNum = Math.floor(Number(qty));
  if (qtyNum < 0 && type !== 'manual') return { error: '數量需為正整數' };
  if (type === 'manual' && qtyNum < 0) return { error: '手動設定庫存不可為負' };

  const { data: result, error } = await supabase.rpc('adjust_inventory', {
    p_product_id: productId,
    p_user_id: user.id,
    p_type: type,
    p_qty: qtyNum,
    p_note: note || null,
  });

  if (error) return { error: error.message };
  const physical = Number((result as { physical_stock?: number } | null)?.physical_stock ?? 0);
  return { qtyAfter: physical };
}

export type StockHistoryRecord = {
  id: string;
  created_at: string;
  product_name: string;
  type: string;
  qty_change: number;
  qty_after: number;
  note: string | null;
};

export type FetchStockHistoryParams = {
  productId?: string;
  page?: number;
  pageSize?: number;
};

export type FetchStockHistoryResult = {
  records: StockHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export async function fetchStockHistory(
  params: FetchStockHistoryParams = {}
): Promise<FetchStockHistoryResult> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { records: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const { productId, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('stock_adjustments')
    .select('id, product_id, type, qty_change, qty_after, note, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data: rows, count, error } = await query;

  if (error) {
    console.error('fetchStockHistory:', error.message);
    return { records: [], total: 0, page, pageSize };
  }

  const list = (rows ?? []) as (Record<string, unknown> & { product_id: string })[];
  const productIds = [...new Set(list.map((r) => r.product_id))];
  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .in('id', productIds);
  const nameMap = new Map((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

  const records: StockHistoryRecord[] = list.map((r) => ({
    id: String(r.id),
    created_at: String(r.created_at),
    product_name: nameMap.get(r.product_id) ?? '—',
    type: String(r.type),
    qty_change: Number(r.qty_change),
    qty_after: Number(r.qty_after),
    note: r.note != null ? String(r.note) : null,
  }));

  return {
    records,
    total: count ?? 0,
    page,
    pageSize,
  };
}
