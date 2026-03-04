'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { NewsArticle } from './news';

/**
 * Get all published news (public, no auth required)
 */
export async function getPublishedNewsList() {
  const supabase = createServerClient();

  // Try with join and enhanced fields first
  let result = await supabase
    .from('news')
    .select('*, news_categories(name)')
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });

  if (result.error) {
    // Fallback: basic select without join or enhanced columns
    result = await supabase
      .from('news')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false });
  }

  if (result.error) {
    console.error('Failed to fetch published news:', result.error);
    return [];
  }

  return (result.data || []).map((item: any) => ({
    ...item,
    category_name: item.news_categories?.name || null,
    content_blocks: item.content_blocks || [],
    is_pinned: item.is_pinned ?? false,
    summary: item.summary ?? null,
  })) as NewsArticle[];
}

/**
 * Get a single published news article by ID (public, no auth required)
 */
export async function getPublishedNewsById(id: string) {
  const supabase = createServerClient();

  // Try with join first
  let result = await supabase
    .from('news')
    .select('*, news_categories(name)')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();

  if (result.error) {
    // Fallback: basic select
    result = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle();
  }

  if (result.error) {
    console.error('Failed to fetch news by id:', result.error);
    return null;
  }

  if (!result.data) {
    return null;
  }

  return {
    ...result.data,
    category_name: (result.data as any).news_categories?.name || null,
    content_blocks: result.data.content_blocks || [],
    is_pinned: result.data.is_pinned ?? false,
    summary: result.data.summary ?? null,
  } as NewsArticle;
}
