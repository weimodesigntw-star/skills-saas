'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Gallery type from database
 */
export interface Gallery {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  photo_count?: number;
}

/**
 * Gallery photo type from database
 */
export interface GalleryPhoto {
  id: string;
  gallery_id: string;
  user_id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

/**
 * Get all galleries for current user
 */
export async function getGalleries() {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('galleries')
    .select('*, gallery_photos(count)')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch galleries: ${error.message}`);
  }

  // Map the count from nested query
  const galleries = (data || []).map((g: any) => ({
    ...g,
    photo_count: g.gallery_photos?.[0]?.count || 0,
  }));

  return galleries as Gallery[];
}

/**
 * Get a single gallery with its photos
 */
export async function getGalleryWithPhotos(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('galleries')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch gallery: ${error.message}`);
  }

  if (!data) {
    throw new Error('Gallery not found');
  }

  // Get photos
  const { data: photos, error: photosError } = await supabase
    .from('gallery_photos')
    .select('*')
    .eq('gallery_id', id)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (photosError) {
    throw new Error(`Failed to fetch photos: ${photosError.message}`);
  }

  return {
    gallery: data as Gallery,
    photos: (photos as GalleryPhoto[]) || [],
  };
}

/**
 * Create a gallery
 */
export async function createGallery(formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  if (!title || title.trim().length === 0) {
    throw new Error('標題不能為空');
  }

  const { data, error } = await supabase
    .from('galleries')
    .insert({
      user_id: user.id,
      title: title.trim(),
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create gallery: ${error.message}`);
  }

  revalidatePath('/dashboard/galleries');
  return data as Gallery;
}

/**
 * Update a gallery
 */
export async function updateGallery(id: string, formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;

  if (!title || title.trim().length === 0) {
    throw new Error('標題不能為空');
  }

  const { data, error } = await supabase
    .from('galleries')
    .update({
      title: title.trim(),
      description: description || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update gallery: ${error.message}`);
  }

  revalidatePath('/dashboard/galleries');
  revalidatePath(`/dashboard/galleries/${id}`);
  return data as Gallery;
}

/**
 * Delete a gallery (cascade deletes photos)
 */
export async function deleteGallery(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('galleries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete gallery: ${error.message}`);
  }

  revalidatePath('/dashboard/galleries');
}

/**
 * Upload a photo to a gallery
 */
export async function uploadGalleryPhoto(galleryId: string, formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify gallery ownership
  const { data: gallery } = await supabase
    .from('galleries')
    .select('id')
    .eq('id', galleryId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!gallery) {
    throw new Error('Gallery not found or unauthorized');
  }

  const imageFile = formData.get('image') as File | null;
  const caption = formData.get('caption') as string;

  if (!imageFile || imageFile.size === 0) {
    throw new Error('請選擇圖片');
  }

  // Upload image using admin client to bypass storage RLS
  const adminClient = createAdminClient();
  const timestamp = Date.now();
  const ext = imageFile.name.split('.').pop() || 'png';
  const safeName = imageFile.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50) || 'photo';
  const filename = `${user.id}/${galleryId}/${timestamp}-${safeName}.${ext}`;

  const { data: uploadData, error: uploadError } = await adminClient.storage
    .from('galleries')
    .upload(filename, imageFile, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload image: ${uploadError.message}`);
  }

  const { data: urlData } = adminClient.storage
    .from('galleries')
    .getPublicUrl(uploadData.path);

  const imageUrl = urlData.publicUrl;

  // Create photo record
  const { data, error } = await supabase
    .from('gallery_photos')
    .insert({
      gallery_id: galleryId,
      user_id: user.id,
      image_url: imageUrl,
      caption: caption || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save photo: ${error.message}`);
  }

  // Update gallery cover if it's the first photo
  const { data: galleryData } = await supabase
    .from('galleries')
    .select('cover_image_url')
    .eq('id', galleryId)
    .single();

  if (!galleryData?.cover_image_url) {
    await supabase
      .from('galleries')
      .update({ cover_image_url: imageUrl })
      .eq('id', galleryId);
  }

  revalidatePath(`/dashboard/galleries/${galleryId}`);
  revalidatePath('/dashboard/galleries');
  return data as GalleryPhoto;
}

/**
 * Delete a photo from a gallery
 */
export async function deleteGalleryPhoto(photoId: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Get photo info before deleting
  const { data: photo } = await supabase
    .from('gallery_photos')
    .select('id, gallery_id, image_url')
    .eq('id', photoId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!photo) {
    throw new Error('Photo not found or unauthorized');
  }

  // Delete from storage
  if (photo.image_url) {
    try {
      const adminClient = createAdminClient();
      const urlParts = photo.image_url.split('/');
      const filepath = urlParts.slice(-3).join('/');
      await adminClient.storage.from('galleries').remove([filepath]);
    } catch (err) {
      console.error('Failed to delete image from storage:', err);
    }
  }

  // Delete record
  const { error } = await supabase
    .from('gallery_photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }

  revalidatePath(`/dashboard/galleries/${photo.gallery_id}`);
  revalidatePath('/dashboard/galleries');
}
