'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import {
  type ProductTagManageDimension,
  isProductTagDimension,
} from '@/lib/constants/product-tags';
import { getAuthAndWorkspace } from '@/lib/workspace';

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
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from('product_tags')
    .select('id, name, color, dimension, sort_order')
    .eq('user_id', ownerId)
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
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) throw new Error('Unauthorized');

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('user_id', ownerId)
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
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('product_tags')
    .select('id, name, color, dimension, sort_order')
    .eq('user_id', ownerId)
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
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) throw new Error('Unauthorized');

  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (!product) throw new Error('Product not found');

  const unique = [...new Set(tagIds)].filter(Boolean);

  if (unique.length > 0) {
    const { data: tags, error: tagErr } = await supabase
      .from('product_tags')
      .select('id')
      .eq('user_id', ownerId)
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

/** 列表顯示用（小 chip） */
export type ProductTagChip = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

/**
 * 同時擁有所有指定標籤的商品 id（AND）。
 * 用於商品列表 `?tags=a,b` 篩選。
 */
export async function getProductIdsWithAllTags(tagIds: string[]): Promise<string[]> {
  const unique = [...new Set(tagIds)].filter(Boolean);
  if (unique.length === 0) return [];

  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return [];

  const { data: rows, error } = await supabase
    .from('product_tag_map')
    .select('product_id, tag_id')
    .in('tag_id', unique);

  if (error) {
    throw new Error(`Failed to filter by tags: ${error.message}`);
  }

  const byProduct = new Map<string, Set<string>>();
  for (const r of rows ?? []) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, new Set());
    byProduct.get(r.product_id)!.add(r.tag_id);
  }

  const need = new Set(unique);
  const result: string[] = [];
  for (const [pid, tagSet] of byProduct) {
    if ([...need].every((t) => tagSet.has(t))) {
      result.push(pid);
    }
  }
  return result;
}

/**
 * 批次查詢多個商品已套用的標籤（供列表欄位顯示）
 */
export async function getTagsBatchForProducts(
  productIds: string[]
): Promise<Record<string, ProductTagChip[]>> {
  if (productIds.length === 0) return {};

  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return {};

  const { data: maps, error: mapErr } = await supabase
    .from('product_tag_map')
    .select('product_id, tag_id')
    .in('product_id', productIds);

  if (mapErr) {
    throw new Error(`Failed to load product tags: ${mapErr.message}`);
  }

  if (!maps?.length) return {};

  const allTagIds = [...new Set(maps.map((m) => m.tag_id))];
  const { data: tags, error: tagErr } = await supabase
    .from('product_tags')
    .select('id, name, color, sort_order')
    .eq('user_id', ownerId)
    .in('id', allTagIds);

  if (tagErr) {
    throw new Error(`Failed to load tags: ${tagErr.message}`);
  }

  const tagById = new Map((tags ?? []).map((t) => [t.id, t]));
  const out: Record<string, ProductTagChip[]> = {};

  for (const m of maps) {
    const t = tagById.get(m.tag_id);
    if (!t) continue;
    if (!out[m.product_id]) out[m.product_id] = [];
    out[m.product_id].push({
      id: t.id,
      name: t.name,
      color: t.color,
      sort_order: t.sort_order,
    });
  }

  for (const pid of Object.keys(out)) {
    out[pid].sort((a, b) => a.sort_order - b.sort_order);
  }

  return out;
}

/**
 * 新增標籤（維度建立後不可改，僅能改名／改色）
 */
export async function createProductTag(
  name: string,
  color: string,
  dimension: ProductTagManageDimension
): Promise<{ success?: true; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: '標籤名稱不能為空' };
  if (!isProductTagDimension(dimension)) return { error: '無效的維度' };

  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: dup } = await supabase
    .from('product_tags')
    .select('id')
    .eq('user_id', ownerId)
    .eq('name', trimmed)
    .maybeSingle();

  if (dup) return { error: `標籤「${trimmed}」已存在` };

  const { data: maxRow } = await supabase
    .from('product_tags')
    .select('sort_order')
    .eq('user_id', ownerId)
    .eq('dimension', dimension)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? 0) + 1;
  const hex = color.trim() || '#6b7280';

  const { error } = await supabase.from('product_tags').insert({
    user_id: ownerId,
    name: trimmed,
    color: hex,
    dimension,
    sort_order,
  });

  if (error) {
    if (error.code === '23505') return { error: `標籤「${trimmed}」已存在` };
    return { error: error.message };
  }

  revalidatePath('/dashboard/product-tags');
  revalidatePath('/dashboard/products');
  return { success: true };
}

/**
 * 更新標籤（僅改名／改色，維度不可變）
 */
export async function updateProductTag(
  tagId: string,
  name: string,
  color: string
): Promise<{ success?: true; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: '標籤名稱不能為空' };

  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: owned } = await supabase
    .from('product_tags')
    .select('id')
    .eq('id', tagId)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (!owned) return { error: '找不到標籤或無權限' };

  const { data: dup } = await supabase
    .from('product_tags')
    .select('id')
    .eq('user_id', ownerId)
    .eq('name', trimmed)
    .neq('id', tagId)
    .maybeSingle();

  if (dup) return { error: `標籤「${trimmed}」已存在` };

  const hex = color.trim() || '#6b7280';

  const { error } = await supabase
    .from('product_tags')
    .update({ name: trimmed, color: hex })
    .eq('id', tagId)
    .eq('user_id', ownerId);

  if (error) {
    if (error.code === '23505') return { error: `標籤「${trimmed}」已存在` };
    return { error: error.message };
  }

  revalidatePath('/dashboard/product-tags');
  revalidatePath('/dashboard/products');
  return { success: true };
}

/**
 * 刪除標籤。若有商品使用且未傳 force，回傳 usageCount 供前端顯示防呆。
 * force=true 時會先刪除 product_tag_map 再刪標籤。
 */
export async function deleteProductTag(
  tagId: string,
  options?: { force?: boolean }
): Promise<{ success?: true; error?: string; usageCount?: number }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: tag } = await supabase
    .from('product_tags')
    .select('id, name')
    .eq('id', tagId)
    .eq('user_id', ownerId)
    .maybeSingle();

  if (!tag) return { error: '找不到標籤或無權限' };

  const { count, error: countErr } = await supabase
    .from('product_tag_map')
    .select('*', { count: 'exact', head: true })
    .eq('tag_id', tagId);

  if (countErr) return { error: countErr.message };

  const n = count ?? 0;
  if (n > 0 && !options?.force) {
    return {
      error: `此標籤正被 ${n} 個商品使用，無法直接刪除`,
      usageCount: n,
    };
  }

  if (n > 0 && options?.force) {
    const { error: mapErr } = await supabase.from('product_tag_map').delete().eq('tag_id', tagId);
    if (mapErr) return { error: mapErr.message };
  }

  const { error: delErr } = await supabase
    .from('product_tags')
    .delete()
    .eq('id', tagId)
    .eq('user_id', ownerId);

  if (delErr) {
    return { error: delErr.message };
  }

  revalidatePath('/dashboard/product-tags');
  revalidatePath('/dashboard/products');
  return { success: true };
}
