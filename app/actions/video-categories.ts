'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';

export interface VideoCategory {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all video categories for current user
 */
export async function getVideoCategories() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('video_categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    // Table might not exist yet (migration 013 not applied)
    console.warn('video_categories query failed (table may not exist):', error.message);
    return [];
  }

  return (data as VideoCategory[]) || [];
}

/**
 * Create a video category
 */
export async function createVideoCategory(name: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('分類名稱不能為空');
  }

  const { data, error } = await supabase
    .from('video_categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
    })
    .select()
    .single();

  if (error) {
    if (error.message?.includes('relation') || error.code === '42P01') {
      throw new Error('分類功能尚未啟用，請先執行資料庫遷移 013');
    }
    throw new Error(`Failed to create category: ${error.message}`);
  }

  revalidatePath('/dashboard/videos');
  return data as VideoCategory;
}

/**
 * Update a video category
 */
export async function updateVideoCategory(id: string, name: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  if (!name || name.trim().length === 0) {
    throw new Error('分類名稱不能為空');
  }

  const { data, error } = await supabase
    .from('video_categories')
    .update({ name: name.trim() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }

  revalidatePath('/dashboard/videos');
  return data as VideoCategory;
}

/**
 * Delete a video category
 */
export async function deleteVideoCategory(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('video_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }

  revalidatePath('/dashboard/videos');
}
