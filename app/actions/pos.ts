/**
 * POS Server Actions
 *
 * 處理 POS 模組的商品查詢和條碼掃描
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types/pos';

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

