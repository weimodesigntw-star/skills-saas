/**
 * Inventory Server Actions
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

const LOW_STOCK_THRESHOLD = 5;
const DEFAULT_PAGE_SIZE = 20;

export type DepotStock = {
  depot_id: string;
  depot_name: string;
  depot_code: string | null;
  qty: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  category_name: string | null;
  barcode: string | null;
  stock: number;
  depot_stocks: DepotStock[];
  is_low_stock: boolean;
};

const INVENTORY_SORT_COLUMNS = ['stock', 'name', 'barcode'] as const;

export type FetchInventoryParams = {
  categoryId?: string;
  depotId?: string;
  lowStockOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
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
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { items: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const { categoryId, depotId, lowStockOnly, search, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
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
    .eq('user_id', ownerId)
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

  if (depotId && depotId !== 'all') {
    const { data: depotStockMatches, error: depotStockError } = await supabase
      .from('product_depot_stocks')
      .select('product_id')
      .eq('user_id', ownerId)
      .eq('depot_id', depotId);

    if (depotStockError) {
      console.error('fetchInventory depot filter:', depotStockError.message);
      return { items: [], total: 0, page, pageSize };
    }

    const productIdsInDepot = [...new Set((depotStockMatches ?? []).map((row) => row.product_id as string))];
    if (productIdsInDepot.length === 0) {
      return { items: [], total: 0, page, pageSize };
    }
    query = query.in('id', productIdsInDepot);
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

  const productIds = rows.map((r) => r.id);
  let depotStockRows: unknown[] = [];
  if (productIds.length) {
    let depotStockQuery = supabase
      .from('product_depot_stocks')
      .select('product_id, depot_id, qty, depots(depot_code, depot_name)')
      .eq('user_id', ownerId)
      .in('product_id', productIds);

    if (depotId && depotId !== 'all') {
      depotStockQuery = depotStockQuery.eq('depot_id', depotId);
    }

    const { data: stockRows, error: stockRowsError } = await depotStockQuery;
    if (stockRowsError) {
      console.error('fetchInventory depot stocks:', stockRowsError.message);
    }
    depotStockRows = stockRows ?? [];
  }

  const depotStocksByProduct = new Map<string, DepotStock[]>();
  for (const row of depotStockRows as {
    product_id: string;
    depot_id: string;
    qty: number;
    depots: { depot_code: string | null; depot_name: string } | { depot_code: string | null; depot_name: string }[] | null;
  }[]) {
    const depot = Array.isArray(row.depots) ? row.depots[0] : row.depots;
    const list = depotStocksByProduct.get(row.product_id) ?? [];
    list.push({
      depot_id: row.depot_id,
      depot_code: depot?.depot_code ?? null,
      depot_name: depot?.depot_name ?? '未命名倉庫',
      qty: Number(row.qty ?? 0),
    });
    depotStocksByProduct.set(row.product_id, list);
  }

  const items: InventoryItem[] = rows.map((r) => {
    const threshold = r.low_stock_threshold ?? LOW_STOCK_THRESHOLD;
    const depotStocks = depotStocksByProduct.get(r.id) ?? [];
    const stock = depotStocks.length
      ? depotStocks.reduce((sum, depot) => sum + depot.qty, 0)
      : Number(r.stock ?? 0);
    const cat = r.categories;
    const categoryName = Array.isArray(cat) ? cat[0]?.name : cat?.name;
    return {
      id: r.id,
      name: r.name,
      category_name: categoryName ?? null,
      barcode: r.barcode ?? null,
      stock,
      depot_stocks: depotStocks,
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
  depotId?: string;
  type: 'restock' | 'loss' | 'manual';
  qty: number;
  note?: string;
};

export async function adjustStock(
  data: AdjustStockParams
): Promise<{ qtyAfter: number } | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { productId, depotId, type, qty, note } = data;
  if (!productId || !type) return { error: '缺少商品或調整類型' };
  if (!depotId) return { error: '請選擇倉庫' };
  if (type !== 'restock' && type !== 'loss' && type !== 'manual') return { error: '無效的調整類型' };
  const qtyNum = Math.floor(Number(qty));
  if (qtyNum < 0 && type !== 'manual') return { error: '數量不可為負數' };
  if (type === 'manual' && qtyNum < 0) return { error: '手動設定庫存不可為負' };

  const { data: result, error } = await supabase.rpc('adjust_inventory', {
    p_product_id: productId,
    p_user_id: ownerId,
    p_type: type,
    p_qty: qtyNum,
    p_note: note || null,
    p_depot_id: depotId,
  });

  if (error) return { error: error.message };
  const physical = Number((result as { physical_stock?: number } | null)?.physical_stock ?? 0);
  revalidatePath('/dashboard/inventory');
  revalidatePath('/dashboard/pos/inventory');
  revalidatePath('/dashboard/products');
  return { qtyAfter: physical };
}

export type StockHistoryRecord = {
  id: string;
  created_at: string;
  product_name: string;
  depot_name: string | null;
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
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { records: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE };

  const { productId, page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('stock_adjustments')
    .select('id, product_id, depot_id, type, qty_change, qty_after, note, created_at', { count: 'exact' })
    .eq('user_id', ownerId)
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
  const depotIds = [...new Set(list.map((r) => String(r.depot_id ?? '')).filter(Boolean))];

  const { data: products } = productIds.length
    ? await supabase.from('products').select('id, name').in('id', productIds)
    : { data: [] };
  const nameMap = new Map((products ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));

  const { data: depots } = depotIds.length
    ? await supabase.from('depots').select('id, depot_name').in('id', depotIds)
    : { data: [] };
  const depotNameMap = new Map((depots ?? []).map((d: { id: string; depot_name: string }) => [d.id, d.depot_name]));

  const records: StockHistoryRecord[] = list.map((r) => ({
    id: String(r.id),
    created_at: String(r.created_at),
    product_name: nameMap.get(r.product_id) ?? '未知商品',
    depot_name: depotNameMap.get(String(r.depot_id ?? '')) ?? null,
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
