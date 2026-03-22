'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export type ProductTag = {
  id: string;
  name: string;
  color: string;
  dimension: string;
  sort_order: number;
};

/**
 * 目前使用者全部標籤（依 sort_order，與種子 1–33 一致）
 */
export async function listProductTags(): Promise<ProductTag[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('product_tags')
    .select('id, name, color, dimension, sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to list tags: ${error.message}`);
  }

  return (data ?? []) as ProductTag[];
}

/**
 * 商品已套用的 tag_id 列表
 */
export async function getProductTagIds(productId: string): Promise<string[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!product) throw new Error('Product not found');

  const { data, error } = await supabase
    .from('product_tag_map')
    .select('tag_id')
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Failed to fetch product tags: ${error.message}`);
  }

  return (data ?? []).map((r) => r.tag_id);
}

/**
 * 商品已套用的完整標籤（含 color / dimension）
 */
export async function getProductTagsForProduct(productId: string): Promise<ProductTag[]> {
  const ids = await getProductTagIds(productId);
  if (ids.length === 0) return [];

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('product_tags')
    .select('id, name, color, dimension, sort_order')
    .eq('user_id', user.id)
    .in('id', ids)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch product tags: ${error.message}`);
  }

  return (data ?? []) as ProductTag[];
}

/**
 * 覆寫商品標籤（先清空 map 再插入）；tagIds 須皆屬於目前使用者
 */
export async function setProductTags(productId: string, tagIds: string[]): Promise<void> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!product) throw new Error('Product not found');

  const unique = [...new Set(tagIds)].filter(Boolean);

  if (unique.length > 0) {
    const { data: tags, error: tagErr } = await supabase
      .from('product_tags')
      .select('id')
      .eq('user_id', user.id)
      .in('id', unique);

    if (tagErr) throw new Error(tagErr.message);
    if (!tags || tags.length !== unique.length) {
      throw new Error('Invalid tag selection');
    }
  }

  const { error: delErr } = await supabase.from('product_tag_map').delete().eq('product_id', productId);

  if (delErr) throw new Error(`Failed to clear tags: ${delErr.message}`);

  if (unique.length > 0) {
    const rows = unique.map((tag_id) => ({ product_id: productId, tag_id }));
    const { error: insErr } = await supabase.from('product_tag_map').insert(rows);
    if (insErr) throw new Error(`Failed to set tags: ${insErr.message}`);
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${productId}`);
}
