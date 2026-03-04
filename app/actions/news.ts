'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Content block type for structured content
 */
export interface ContentBlock {
  id: string;
  type: 'text' | 'image';
  content?: string;       // HTML content for text blocks
  imageUrl?: string;      // Image URL for image blocks
  caption?: string;       // Image caption
  maxWidth?: string;      // Image max width in px
  align?: string;         // Image alignment: left | center | right
}

/**
 * News article type from database
 */
export interface NewsArticle {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  summary: string | null;
  cover_image_url: string | null;
  category_id: string | null;
  is_published: boolean;
  is_pinned: boolean;
  sort_order: number;
  content_blocks: ContentBlock[];
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name?: string;
}

/**
 * Get all news for current user (with category name)
 */
export async function getNewsList() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Try with join first, fallback to basic select
  let result = await supabase
    .from('news')
    .select('*, news_categories(name)')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (result.error) {
    // Fallback: basic select without join
    result = await supabase
      .from('news')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
  }

  if (result.error) {
    throw new Error(`Failed to fetch news: ${result.error.message}`);
  }

  const articles = (result.data || []).map((item: any) => ({
    ...item,
    category_name: item.news_categories?.name || null,
    content_blocks: item.content_blocks || [],
    is_pinned: item.is_pinned ?? false,
    summary: item.summary ?? null,
    category_id: item.category_id ?? null,
  }));

  return articles as NewsArticle[];
}

/**
 * Get a single news article by ID
 */
export async function getNewsById(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Try with join first, fallback to basic select
  let result = await supabase
    .from('news')
    .select('*, news_categories(name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (result.error) {
    result = await supabase
      .from('news')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
  }

  if (result.error) {
    throw new Error(`Failed to fetch news: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error('News not found');
  }

  return {
    ...result.data,
    category_name: (result.data as any).news_categories?.name || null,
    content_blocks: result.data.content_blocks || [],
    is_pinned: result.data.is_pinned ?? false,
    summary: result.data.summary ?? null,
    category_id: result.data.category_id ?? null,
  } as NewsArticle;
}

/**
 * Search news articles (for related news feature)
 */
export async function searchNews(query: string, excludeId?: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Try with join first
  let queryBuilder = supabase
    .from('news')
    .select('id, title, category_id, is_published, published_at, news_categories(name)')
    .eq('user_id', user.id)
    .ilike('title', `%${query}%`)
    .limit(10);

  if (excludeId) {
    queryBuilder = queryBuilder.neq('id', excludeId);
  }

  let { data, error } = await queryBuilder;

  if (error) {
    // Fallback: basic select without join
    let fallbackBuilder = supabase
      .from('news')
      .select('id, title, is_published, published_at')
      .eq('user_id', user.id)
      .ilike('title', `%${query}%`)
      .limit(10);

    if (excludeId) {
      fallbackBuilder = fallbackBuilder.neq('id', excludeId);
    }

    const fallbackResult = await fallbackBuilder;
    data = fallbackResult.data as any;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Failed to search news: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    ...item,
    category_name: item.news_categories?.name || null,
  }));
}

/**
 * Get related news for an article
 */
export async function getRelatedNews(newsId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('news_related')
    .select('related_news_id, news!news_related_related_news_id_fkey(id, title, category_id, published_at, news_categories(name))')
    .eq('news_id', newsId)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) {
    // If the join fails, return empty
    console.error('Failed to fetch related news:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.news?.id,
    title: item.news?.title,
    category_name: item.news?.news_categories?.name || null,
    published_at: item.news?.published_at,
    relation_id: item.related_news_id,
  }));
}

/**
 * Add a related news link
 */
export async function addRelatedNews(newsId: string, relatedNewsId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('news_related')
    .insert({
      news_id: newsId,
      related_news_id: relatedNewsId,
      user_id: user.id,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('此相關消息已存在');
    }
    throw new Error(`Failed to add related news: ${error.message}`);
  }

  revalidatePath(`/dashboard/news/${newsId}`);
}

/**
 * Remove a related news link
 */
export async function removeRelatedNews(newsId: string, relatedNewsId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('news_related')
    .delete()
    .eq('news_id', newsId)
    .eq('related_news_id', relatedNewsId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to remove related news: ${error.message}`);
  }

  revalidatePath(`/dashboard/news/${newsId}`);
}

/**
 * Upload news image to Supabase storage
 */
async function uploadNewsImage(userId: string, newsId: string, imageFile: File): Promise<string> {
  const adminClient = createAdminClient();
  const timestamp = Date.now();
  const ext = imageFile.name.split('.').pop() || 'png';
  const safeName = imageFile.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50) || 'image';
  const filename = `${userId}/news/${newsId}/${timestamp}-${safeName}.${ext}`;

  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('news')
    .upload(filename, imageFile, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
      await adminClient.storage.createBucket('news', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });
      const { data: retryData, error: retryError } = await adminClient.storage
        .from('news')
        .upload(filename, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });
      if (retryError) {
        throw new Error(`圖片上傳失敗: ${retryError.message}`);
      }
      const { data: urlData } = adminClient.storage
        .from('news')
        .getPublicUrl(retryData.path);
      return urlData.publicUrl;
    }
    throw new Error(`圖片上傳失敗: ${uploadError.message}`);
  }

  const { data: urlData } = adminClient.storage
    .from('news')
    .getPublicUrl(uploadData.path);

  return urlData.publicUrl;
}

/**
 * Upload a content block image
 */
export async function uploadContentBlockImage(newsId: string, imageFile: File): Promise<string> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  return uploadNewsImage(user.id, newsId, imageFile);
}

/**
 * Delete news image from Supabase storage
 */
async function deleteNewsImage(imageUrl: string) {
  try {
    const adminClient = createAdminClient();
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/storage/v1/object/public/news/');
    if (pathParts.length > 1) {
      await adminClient.storage.from('news').remove([pathParts[1]]);
    }
  } catch (err) {
    console.error('Failed to delete news image from storage:', err);
  }
}

/**
 * Create a news article
 */
export async function createNews(formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const summary = formData.get('summary') as string;
  const is_published = formData.get('is_published') === 'true';
  const is_pinned = formData.get('is_pinned') === 'true';
  const published_at = formData.get('published_at') as string;
  const category_id = formData.get('category_id') as string;
  const content_blocks_str = formData.get('content_blocks') as string;
  const imageFile = formData.get('cover_image') as File | null;

  if (!title || title.trim().length === 0) {
    throw new Error('標題不能為空');
  }

  let content_blocks: ContentBlock[] = [];
  if (content_blocks_str) {
    try {
      content_blocks = JSON.parse(content_blocks_str);
    } catch {}
  }

  // Build insert data - include enhanced fields only if they have values
  const insertData: Record<string, any> = {
    user_id: user.id,
    title: title.trim(),
    content: content || '',
    is_published,
    published_at: published_at || (is_published ? new Date().toISOString() : null),
  };
  // Enhanced fields (from migration 012) - add only if provided
  if (summary) insertData.summary = summary;
  if (category_id) insertData.category_id = category_id;
  if (is_pinned) insertData.is_pinned = true;
  if (content_blocks.length > 0) insertData.content_blocks = content_blocks;

  // Try with enhanced fields first, fallback to basic fields
  let data: any;
  let error: any;

  const result = await supabase
    .from('news')
    .insert(insertData)
    .select('*')
    .single();

  data = result.data;
  error = result.error;

  // If error due to missing columns, retry with basic fields only
  if (error && (error.message?.includes('column') || error.code === '42703')) {
    const basicResult = await supabase
      .from('news')
      .insert({
        user_id: user.id,
        title: title.trim(),
        content: content || '',
        is_published,
        published_at: published_at || (is_published ? new Date().toISOString() : null),
      })
      .select('*')
      .single();
    data = basicResult.data;
    error = basicResult.error;
  }

  if (error) {
    throw new Error(`Failed to create news: ${error.message}`);
  }

  // Upload cover image if provided
  if (imageFile && imageFile.size > 0) {
    try {
      const imageUrl = await uploadNewsImage(user.id, data.id, imageFile);
      const { data: updated, error: updateError } = await supabase
        .from('news')
        .update({ cover_image_url: imageUrl })
        .eq('id', data.id)
        .select('*')
        .single();

      if (!updateError && updated) {
        revalidatePath('/dashboard/news');
        return {
          ...updated,
          category_name: null,
          content_blocks: updated.content_blocks || [],
        } as NewsArticle;
      }
    } catch (err) {
      console.error('Image upload failed, news created without cover:', err);
    }
  }

  revalidatePath('/dashboard/news');
  return {
    ...data,
    category_name: null,
    content_blocks: data.content_blocks || [],
  } as NewsArticle;
}

/**
 * Update a news article
 */
export async function updateNews(id: string, formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: existing } = await supabase
    .from('news')
    .select('id, is_published, cover_image_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    throw new Error('News not found or unauthorized');
  }

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  const summary = formData.get('summary') as string;
  const is_published = formData.get('is_published') === 'true';
  const is_pinned = formData.get('is_pinned') === 'true';
  const published_at = formData.get('published_at') as string;
  const category_id = formData.get('category_id') as string;
  const content_blocks_str = formData.get('content_blocks') as string;
  const imageFile = formData.get('cover_image') as File | null;
  const remove_image = formData.get('remove_image') === 'true';

  if (!title || title.trim().length === 0) {
    throw new Error('標題不能為空');
  }

  let content_blocks: ContentBlock[] = [];
  if (content_blocks_str) {
    try {
      content_blocks = JSON.parse(content_blocks_str);
    } catch {}
  }

  // Basic update data (always safe)
  const updateData: Record<string, any> = {
    title: title.trim(),
    content: content || '',
    is_published,
  };

  // Enhanced fields - add them but handle gracefully if columns don't exist
  if (summary !== undefined) updateData.summary = summary || null;
  if (category_id !== undefined) updateData.category_id = category_id || null;
  if (is_pinned !== undefined) updateData.is_pinned = is_pinned;
  if (content_blocks.length > 0) updateData.content_blocks = content_blocks;

  if (published_at) {
    updateData.published_at = published_at;
  } else if (is_published && !existing.is_published) {
    updateData.published_at = new Date().toISOString();
  }

  if (remove_image && existing.cover_image_url) {
    await deleteNewsImage(existing.cover_image_url);
    updateData.cover_image_url = null;
  }

  if (imageFile && imageFile.size > 0) {
    if (existing.cover_image_url) {
      await deleteNewsImage(existing.cover_image_url);
    }
    try {
      const imageUrl = await uploadNewsImage(user.id, id, imageFile);
      updateData.cover_image_url = imageUrl;
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  }

  // Try full update, fallback to basic fields
  let updateResult = await supabase
    .from('news')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (updateResult.error && (updateResult.error.message?.includes('column') || updateResult.error.code === '42703')) {
    // Fallback: only basic fields
    const basicData: Record<string, any> = {
      title: title.trim(),
      content: content || '',
      is_published,
    };
    if (updateData.published_at) basicData.published_at = updateData.published_at;
    if (updateData.cover_image_url !== undefined) basicData.cover_image_url = updateData.cover_image_url;

    updateResult = await supabase
      .from('news')
      .update(basicData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
  }

  const { data, error } = updateResult;

  if (error) {
    throw new Error(`Failed to update news: ${error.message}`);
  }

  revalidatePath('/dashboard/news');
  revalidatePath(`/dashboard/news/${id}`);
  return {
    ...data,
    category_name: null,
    content_blocks: data.content_blocks || [],
  } as NewsArticle;
}

/**
 * Delete a news article
 */
export async function deleteNews(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: existing } = await supabase
    .from('news')
    .select('cover_image_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.cover_image_url) {
    await deleteNewsImage(existing.cover_image_url);
  }

  const { error } = await supabase
    .from('news')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete news: ${error.message}`);
  }

  revalidatePath('/dashboard/news');
}
