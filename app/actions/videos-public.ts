'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { Video } from './videos';

/**
 * Get all published videos (public, no auth required)
 */
export async function getPublishedVideosList() {
  const supabase = createServerClient();

  // Try with join and enhanced fields first
  let result = await supabase
    .from('videos')
    .select('*, video_categories(name)')
    .eq('is_published', true)
    .order('is_featured', { ascending: false })
    .order('published_at', { ascending: false });

  if (result.error) {
    // Fallback: basic select without join or enhanced columns
    result = await supabase
      .from('videos')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false });
  }

  if (result.error) {
    console.error('Failed to fetch published videos:', result.error);
    return [];
  }

  return (result.data || []).map((item: any) => ({
    ...item,
    category_name: item.video_categories?.name || null,
    is_featured: item.is_featured ?? false,
    summary: item.summary ?? null,
  })) as Video[];
}

/**
 * Get a single published video by ID (public, no auth required)
 */
export async function getPublishedVideoById(id: string) {
  const supabase = createServerClient();

  // Try with join first
  let result = await supabase
    .from('videos')
    .select('*, video_categories(name)')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();

  if (result.error) {
    // Fallback: basic select
    result = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();
  }

  if (result.error) {
    console.error('Failed to fetch video by id:', result.error);
    return null;
  }

  if (!result.data) {
    return null;
  }

  return {
    ...result.data,
    category_name: (result.data as any).video_categories?.name || null,
    is_featured: result.data.is_featured ?? false,
    summary: result.data.summary ?? null,
  } as Video;
}
