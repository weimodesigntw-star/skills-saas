'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

export interface NewsCategory {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all news categories for current user
 */
export async function getNewsCategories() {
  const supabase = createServerClient();

  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('news_categories')
    .select('*')
    .eq('user_id', ownerId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    // Table might not exist yet (migration 012 not applied)
    console.warn('news_categories query failed (table may not exist):', error.message);
    return [];
  }

  return (data as NewsCategory[]) || [];
}

/**
 * Create a news category
 */
export async function createNewsCategory(name: string) {
  const supabase = createServerClient();

  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) {
    throw new Error('Unauthorized');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('分類名稱不能為空');
  }

  const { data, error } = await supabase
    .from('news_categories')
    .insert({
      user_id: ownerId,
      name: name.trim(),
    })
    .select()
    .single();

  if (error) {
    // Table might not exist yet
    if (error.message?.includes('relation') || error.code === '42P01') {
      throw new Error('分類功能尚未啟用，請先執行資料庫遷移 012');
    }
    throw new Error(`Failed to create category: ${error.message}`);
  }

  revalidatePath('/dashboard/news');
  return data as NewsCategory;
}

/**
 * Update a news category
 */
export async function updateNewsCategory(id: string, name: string) {
  const supabase = createServerClient();

  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) {
    throw new Error('Unauthorized');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('分類名稱不能為空');
  }

  const { data, error } = await supabase
    .from('news_categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', ownerId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }

  revalidatePath('/dashboard/news');
  return data as NewsCategory;
}

/**
 * Delete a news category
 */
export async function deleteNewsCategory(id: string) {
  const supabase = createServerClient();

  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('news_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }

  revalidatePath('/dashboard/news');
}
