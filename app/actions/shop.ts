'use server';

import { createAdminClient } from '@/lib/supabase/server';

/**
 * 取得所有上架商品（公開，不需登入）
 * 使用 admin client 繞過 RLS（商品屬於店家，瀏覽者無 user_id 匹配）
 */
export async function getShopProducts(categoryId?: string, search?: string) {
  const admin = createAdminClient();

  let query = admin
    .from('products')
    .select('id, name, description, price, stock, image_url, category_id, sku')
    .eq('is_active', true)
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('getShopProducts error:', error);
    return [];
  }

  return data || [];
}

/**
 * 取得單一商品詳情（公開）
 */
export async function getShopProductById(id: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('products')
    .select('id, name, description, price, stock, image_url, category_id, sku, barcode')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * 取得商品分類列表（公開）
 */
export async function getShopCategories() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('categories')
    .select('id, name, parent_id, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    console.error('getShopCategories error:', error);
    return [];
  }

  return data || [];
}
