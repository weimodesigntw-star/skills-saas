'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { parseVideoUrl, getYouTubeThumbnail } from '@/lib/video-utils';

/**
 * Video type from database
 */
export interface Video {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  summary: string | null;
  video_url: string;
  video_platform: string;
  video_embed_id: string | null;
  duration: string | null;
  thumbnail_url: string | null;
  category_id: string | null;
  is_published: boolean;
  is_featured: boolean;
  sort_order: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  category_name?: string;
}

/**
 * Get all videos for current user (with category name)
 */
export async function getVideosList() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Try with join first, fallback to basic select
  let result = await supabase
    .from('videos')
    .select('*, video_categories(name)')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (result.error) {
    // Fallback: basic select without join
    result = await supabase
      .from('videos')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
  }

  if (result.error) {
    throw new Error(`Failed to fetch videos: ${result.error.message}`);
  }

  const videos = (result.data || []).map((item: any) => ({
    ...item,
    category_name: item.video_categories?.name || null,
    is_featured: item.is_featured ?? false,
    summary: item.summary ?? null,
    category_id: item.category_id ?? null,
  }));

  return videos as Video[];
}

/**
 * Get a single video by ID
 */
export async function getVideoById(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Try with join first, fallback to basic select
  let result = await supabase
    .from('videos')
    .select('*, video_categories(name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (result.error) {
    result = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
  }

  if (result.error) {
    throw new Error(`Failed to fetch video: ${result.error.message}`);
  }

  if (!result.data) {
    throw new Error('Video not found');
  }

  return {
    ...result.data,
    category_name: (result.data as any).video_categories?.name || null,
    is_featured: result.data.is_featured ?? false,
    summary: result.data.summary ?? null,
    category_id: result.data.category_id ?? null,
  } as Video;
}

/**
 * Search videos (for related video feature)
 */
export async function searchVideos(query: string, excludeId?: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  let queryBuilder = supabase
    .from('videos')
    .select('id, title, category_id, is_published, published_at, video_categories(name)')
    .eq('user_id', user.id)
    .ilike('title', `%${query}%`)
    .limit(10);

  if (excludeId) {
    queryBuilder = queryBuilder.neq('id', excludeId);
  }

  let { data, error } = await queryBuilder;

  if (error) {
    let fallbackBuilder = supabase
      .from('videos')
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
    throw new Error(`Failed to search videos: ${error.message}`);
  }

  return (data || []).map((item: any) => ({
    ...item,
    category_name: item.video_categories?.name || null,
  }));
}

/**
 * Get related videos for a video
 */
export async function getRelatedVideos(videoId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('video_related')
    .select('related_video_id, videos!video_related_related_video_id_fkey(id, title, category_id, published_at, video_categories(name))')
    .eq('video_id', videoId)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch related videos:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.videos?.id,
    title: item.videos?.title,
    category_name: item.videos?.video_categories?.name || null,
    published_at: item.videos?.published_at,
    relation_id: item.related_video_id,
  }));
}

/**
 * Add a related video link
 */
export async function addRelatedVideo(videoId: string, relatedVideoId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('video_related')
    .insert({
      video_id: videoId,
      related_video_id: relatedVideoId,
      user_id: user.id,
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('此相關影片已存在');
    }
    throw new Error(`Failed to add related video: ${error.message}`);
  }

  revalidatePath(`/dashboard/videos/${videoId}`);
}

/**
 * Remove a related video link
 */
export async function removeRelatedVideo(videoId: string, relatedVideoId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('video_related')
    .delete()
    .eq('video_id', videoId)
    .eq('related_video_id', relatedVideoId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to remove related video: ${error.message}`);
  }

  revalidatePath(`/dashboard/videos/${videoId}`);
}

/**
 * Upload thumbnail image to Supabase storage
 */
async function uploadThumbnail(userId: string, videoId: string, imageFile: File): Promise<string> {
  const adminClient = createAdminClient();
  const timestamp = Date.now();
  const ext = imageFile.name.split('.').pop() || 'png';
  const safeName = imageFile.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50) || 'thumbnail';
  const filename = `${userId}/videos/${videoId}/${timestamp}-${safeName}.${ext}`;

  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('videos')
    .upload(filename, imageFile, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    if (uploadError.message.includes('not found') || uploadError.message.includes('Bucket')) {
      await adminClient.storage.createBucket('videos', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });
      const { data: retryData, error: retryError } = await adminClient.storage
        .from('videos')
        .upload(filename, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });
      if (retryError) {
        throw new Error(`縮圖上傳失敗: ${retryError.message}`);
      }
      const { data: urlData } = adminClient.storage
        .from('videos')
        .getPublicUrl(retryData.path);
      return urlData.publicUrl;
    }
    throw new Error(`縮圖上傳失敗: ${uploadError.message}`);
  }

  const { data: urlData } = adminClient.storage
    .from('videos')
    .getPublicUrl(uploadData.path);

  return urlData.publicUrl;
}

/**
 * Delete thumbnail from Supabase storage
 */
async function deleteThumbnail(imageUrl: string) {
  try {
    const adminClient = createAdminClient();
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/storage/v1/object/public/videos/');
    if (pathParts.length > 1) {
      await adminClient.storage.from('videos').remove([pathParts[1]]);
    }
  } catch (err) {
    console.error('Failed to delete thumbnail from storage:', err);
  }
}

/**
 * Create a video
 */
export async function createVideo(formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const summary = formData.get('summary') as string;
  const video_url = formData.get('video_url') as string;
  const duration = formData.get('duration') as string;
  const is_published = formData.get('is_published') === 'true';
  const is_featured = formData.get('is_featured') === 'true';
  const published_at = formData.get('published_at') as string;
  const category_id = formData.get('category_id') as string;
  const imageFile = formData.get('thumbnail') as File | null;

  if (!title || title.trim().length === 0) {
    throw new Error('標題不能為空');
  }

  // Parse video URL
  const { platform, embedId } = parseVideoUrl(video_url || '');

  const insertData: Record<string, any> = {
    user_id: user.id,
    title: title.trim(),
    description: description || '',
    video_url: video_url || '',
    video_platform: platform,
    video_embed_id: embedId,
    is_published,
    published_at: published_at || (is_published ? new Date().toISOString() : null),
  };

  if (summary) insertData.summary = summary;
  if (category_id) insertData.category_id = category_id;
  if (is_featured) insertData.is_featured = true;
  if (duration) insertData.duration = duration;

  // Auto-set YouTube thumbnail if no custom thumbnail
  if (!imageFile?.size && platform === 'youtube' && embedId) {
    insertData.thumbnail_url = getYouTubeThumbnail(embedId);
  }

  let data: any;
  let error: any;

  const result = await supabase
    .from('videos')
    .insert(insertData)
    .select('*')
    .single();

  data = result.data;
  error = result.error;

  if (error && (error.message?.includes('column') || error.code === '42703')) {
    const basicResult = await supabase
      .from('videos')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description || '',
        video_url: video_url || '',
        video_platform: platform,
        video_embed_id: embedId,
        is_published,
        published_at: published_at || (is_published ? new Date().toISOString() : null),
      })
      .select('*')
      .single();
    data = basicResult.data;
    error = basicResult.error;
  }

  if (error) {
    throw new Error(`Failed to create video: ${error.message}`);
  }

  // Upload custom thumbnail if provided
  if (imageFile && imageFile.size > 0) {
    try {
      const imageUrl = await uploadThumbnail(user.id, data.id, imageFile);
      const { data: updated, error: updateError } = await supabase
        .from('videos')
        .update({ thumbnail_url: imageUrl })
        .eq('id', data.id)
        .select('*')
        .single();

      if (!updateError && updated) {
        revalidatePath('/dashboard/videos');
        return {
          ...updated,
          category_name: null,
        } as Video;
      }
    } catch (err) {
      console.error('Thumbnail upload failed, video created without custom thumbnail:', err);
    }
  }

  revalidatePath('/dashboard/videos');
  return {
    ...data,
    category_name: null,
  } as Video;
}

/**
 * Update a video
 */
export async function updateVideo(id: string, formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: existing } = await supabase
    .from('videos')
    .select('id, is_published, thumbnail_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    throw new Error('Video not found or unauthorized');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const summary = formData.get('summary') as string;
  const video_url = formData.get('video_url') as string;
  const duration = formData.get('duration') as string;
  const is_published = formData.get('is_published') === 'true';
  const is_featured = formData.get('is_featured') === 'true';
  const published_at = formData.get('published_at') as string;
  const category_id = formData.get('category_id') as string;
  const imageFile = formData.get('thumbnail') as File | null;
  const remove_thumbnail = formData.get('remove_thumbnail') === 'true';

  if (!title || title.trim().length === 0) {
    throw new Error('標題不能為空');
  }

  const { platform, embedId } = parseVideoUrl(video_url || '');

  const updateData: Record<string, any> = {
    title: title.trim(),
    description: description || '',
    video_url: video_url || '',
    video_platform: platform,
    video_embed_id: embedId,
    is_published,
  };

  if (summary !== undefined) updateData.summary = summary || null;
  if (category_id !== undefined) updateData.category_id = category_id || null;
  if (is_featured !== undefined) updateData.is_featured = is_featured;
  if (duration !== undefined) updateData.duration = duration || null;

  if (published_at) {
    updateData.published_at = published_at;
  } else if (is_published && !existing.is_published) {
    updateData.published_at = new Date().toISOString();
  }

  if (remove_thumbnail && existing.thumbnail_url) {
    // Only delete from storage if it's a custom uploaded thumbnail (not YouTube auto)
    if (!existing.thumbnail_url.includes('img.youtube.com')) {
      await deleteThumbnail(existing.thumbnail_url);
    }
    // Auto-set YouTube thumbnail if available
    if (platform === 'youtube' && embedId) {
      updateData.thumbnail_url = getYouTubeThumbnail(embedId);
    } else {
      updateData.thumbnail_url = null;
    }
  }

  if (imageFile && imageFile.size > 0) {
    if (existing.thumbnail_url && !existing.thumbnail_url.includes('img.youtube.com')) {
      await deleteThumbnail(existing.thumbnail_url);
    }
    try {
      const imageUrl = await uploadThumbnail(user.id, id, imageFile);
      updateData.thumbnail_url = imageUrl;
    } catch (err) {
      console.error('Thumbnail upload failed:', err);
    }
  }

  let updateResult = await supabase
    .from('videos')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single();

  if (updateResult.error && (updateResult.error.message?.includes('column') || updateResult.error.code === '42703')) {
    const basicData: Record<string, any> = {
      title: title.trim(),
      description: description || '',
      video_url: video_url || '',
      video_platform: platform,
      video_embed_id: embedId,
      is_published,
    };
    if (updateData.published_at) basicData.published_at = updateData.published_at;
    if (updateData.thumbnail_url !== undefined) basicData.thumbnail_url = updateData.thumbnail_url;

    updateResult = await supabase
      .from('videos')
      .update(basicData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
  }

  const { data, error } = updateResult;

  if (error) {
    throw new Error(`Failed to update video: ${error.message}`);
  }

  revalidatePath('/dashboard/videos');
  revalidatePath(`/dashboard/videos/${id}`);
  return {
    ...data,
    category_name: null,
  } as Video;
}

/**
 * Delete a video
 */
export async function deleteVideo(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: existing } = await supabase
    .from('videos')
    .select('thumbnail_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.thumbnail_url && !existing.thumbnail_url.includes('img.youtube.com')) {
    await deleteThumbnail(existing.thumbnail_url);
  }

  const { error } = await supabase
    .from('videos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete video: ${error.message}`);
  }

  revalidatePath('/dashboard/videos');
}
