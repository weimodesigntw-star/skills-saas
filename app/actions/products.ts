'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

/**
 * Product validation schema
 */
const ProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  description: z.string().max(2000).optional(),
  barcode: z.string().max(255).optional(),
  sku: z.string().max(100).optional(),
  unit_name: z.string().max(50).optional(),
  price: z.number().positive('Price must be greater than 0'),
  cost: z.number().nonnegative('Cost must be non-negative').optional(),
  stock: z.number().nonnegative('Stock must be non-negative'),
  low_stock_threshold: z.number().nonnegative('Low stock threshold must be non-negative').default(5),
  category_id: z.string().uuid().optional(),
  tax_type: z.enum(['taxable', 'tax_free', 'zero_rate']).default('taxable'),
  is_active: z.boolean().default(true),
});

type ProductInput = z.infer<typeof ProductSchema>;

/**
 * Product query type
 */
const PRODUCT_SORT_COLUMNS = ['name', 'price', 'stock', 'created_at'] as const;
export type ProductSortColumn = (typeof PRODUCT_SORT_COLUMNS)[number];

export interface ProductQueryOptions {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  /** S-003 */
  sortBy?: string;
  sortDir?: string;
}

/**
 * Product type from database
 */
export interface Product {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  barcode: string | null;
  sku: string | null;
  unit_name?: string | null;
  price: number;
  cost: number | null;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
  is_active: boolean;
  tax_type: 'taxable' | 'tax_free' | 'zero_rate';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  categories?: {
    id: string;
    name: string;
    user_id: string;
    created_at: string;
  } | null;
}

/**
 * Get products for current user with optional filters and pagination
 */
export async function getProducts(options?: ProductQueryOptions) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const page = options?.page || 1;
  const limit = options?.limit || 20;
  const offset = (page - 1) * limit;

  const sortCol = PRODUCT_SORT_COLUMNS.includes(options?.sortBy as ProductSortColumn)
    ? (options!.sortBy as ProductSortColumn)
    : 'created_at';
  const ascending = options?.sortDir === 'asc';

  let query = supabase
    .from('products')
    .select(
      `
      *,
      categories:category_id(id, name, user_id, created_at)
      `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order(sortCol, { ascending });

  // Apply category filter
  if (options?.categoryId) {
    query = query.eq('category_id', options.categoryId);
  }

  // Apply search filter
  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    query = query.or(`name.ilike.${searchTerm},barcode.ilike.${searchTerm},sku.ilike.${searchTerm}`);
  }

  // Apply pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch products: ${error.message}`);
  }

  return {
    products: (data as Product[]) || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

/**
 * Get a single product by ID
 */
export async function getProduct(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      *,
      categories:category_id(id, name, user_id, created_at)
      `
    )
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch product: ${error.message}`);
  }

  if (!data) {
    throw new Error('Product not found');
  }

  return data as Product;
}

/**
 * Create a new product from FormData (including image upload)
 */
export async function createProduct(formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Extract form fields
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const barcode = formData.get('barcode') as string;
  const sku = formData.get('sku') as string;
  const unit_name = (formData.get('unit_name') as string) || null;
  const price = parseFloat(formData.get('price') as string);
  const cost = formData.get('cost') ? parseFloat(formData.get('cost') as string) : null;
  const stock = parseInt(formData.get('stock') as string);
  const low_stock_threshold = parseInt(formData.get('low_stock_threshold') as string) || 5;
  const category_id = formData.get('category_id') as string;
  const tax_type = (formData.get('tax_type') as string) || 'taxable';
  const is_active = formData.get('is_active') === 'true';
  const product_code = (formData.get('product_code') as string) || null;
  const whole_sell_price = formData.get('whole_sell_price') != null ? parseFloat(formData.get('whole_sell_price') as string) : 0;
  const purchase_price = formData.get('purchase_price') != null ? parseFloat(formData.get('purchase_price') as string) : 0;
  const vendor_id = (formData.get('vendor_id') as string) || null;
  const depot_id = (formData.get('depot_id') as string) || null;
  const imageFile = formData.get('image') as File | null;

  // Validate input
  const validated = ProductSchema.parse({
    name,
    description: description || undefined,
    barcode: barcode || undefined,
    sku: sku || undefined,
    price,
    cost,
    stock,
    low_stock_threshold,
    category_id: category_id || undefined,
    tax_type,
    is_active,
  });

  // Check barcode uniqueness if provided
  if (validated.barcode) {
    const { data: existingBarcode } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', validated.barcode)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingBarcode) {
      throw new Error('Barcode already exists');
    }
  }

  let imageUrl: string | null = null;

  // Upload image if provided (use admin client to bypass storage RLS)
  if (imageFile && imageFile.size > 0) {
    const adminClient = createAdminClient();
    const timestamp = Date.now();
    // Sanitize filename: keep only ASCII-safe chars, replace others with underscore
    const ext = imageFile.name.split('.').pop() || 'png';
    const safeName = imageFile.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50) || 'image';
    const filename = `${user.id}/${timestamp}-${safeName}.${ext}`;

    const { data, error: uploadError } = await adminClient.storage
      .from('product-images')
      .upload(filename, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from('product-images')
      .getPublicUrl(data.path);

    imageUrl = urlData.publicUrl;
  }

  // Create product
  const { data, error } = await supabase
    .from('products')
    .insert({
      user_id: user.id,
      name: validated.name,
      description: validated.description || null,
      barcode: validated.barcode || null,
      sku: validated.sku || null,
    unit_name: validated.unit_name || null,
      price: validated.price,
      cost: validated.cost || null,
      stock: validated.stock,
      low_stock_threshold: validated.low_stock_threshold,
      category_id: validated.category_id || null,
      image_url: imageUrl,
      tax_type: validated.tax_type,
      is_active: validated.is_active,
      metadata: {},
      product_code: product_code || null,
      whole_sell_price: whole_sell_price ?? 0,
      purchase_price: purchase_price ?? 0,
      vendor_id: vendor_id || null,
      depot_id: depot_id || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create product: ${error.message}`);
  }

  revalidatePath('/dashboard/products');
  return data as Product;
}

/**
 * Update an existing product from FormData (with optional new image)
 */
export async function updateProduct(id: string, formData: FormData) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('products')
    .select('id, image_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    throw new Error('Product not found or unauthorized');
  }

  // Extract form fields
  const name = formData.get('name') as string;
  const description = formData.get('description') as string;
  const barcode = formData.get('barcode') as string;
  const sku = formData.get('sku') as string;
  const unit_name = (formData.get('unit_name') as string) || null;
  const price = parseFloat(formData.get('price') as string);
  const cost = formData.get('cost') ? parseFloat(formData.get('cost') as string) : null;
  const stock = parseInt(formData.get('stock') as string);
  const low_stock_threshold = parseInt(formData.get('low_stock_threshold') as string) || 5;
  const category_id = formData.get('category_id') as string;
  const tax_type = (formData.get('tax_type') as string) || 'taxable';
  const is_active = formData.get('is_active') === 'true';
  const product_code = (formData.get('product_code') as string) || null;
  const whole_sell_price = formData.get('whole_sell_price') != null ? parseFloat(formData.get('whole_sell_price') as string) : 0;
  const purchase_price = formData.get('purchase_price') != null ? parseFloat(formData.get('purchase_price') as string) : 0;
  const vendor_id = (formData.get('vendor_id') as string) || null;
  const depot_id = (formData.get('depot_id') as string) || null;
  const imageFile = formData.get('image') as File | null;
  const removeImage = formData.get('removeImage') === 'true';

  // Validate input
  const validated = ProductSchema.parse({
    name,
    description: description || undefined,
    barcode: barcode || undefined,
    sku: sku || undefined,
    price,
    cost,
    stock,
    low_stock_threshold,
    category_id: category_id || undefined,
    tax_type,
    is_active,
  });

  // Check barcode uniqueness if changed
  if (validated.barcode) {
    const { data: existingBarcode } = await supabase
      .from('products')
      .select('id')
      .eq('barcode', validated.barcode)
      .eq('user_id', user.id)
      .neq('id', id)
      .maybeSingle();

    if (existingBarcode) {
      throw new Error('Barcode already exists');
    }
  }

  let imageUrl = existing.image_url;

  // Use admin client for storage operations (bypass RLS)
  const adminClient = createAdminClient();

  // Handle image removal
  if (removeImage && existing.image_url) {
    imageUrl = null;
    try {
      const urlParts = existing.image_url.split('/');
      const filepath = urlParts.slice(-2).join('/');
      await adminClient.storage.from('product-images').remove([filepath]);
    } catch (err) {
      console.error('Failed to delete old image:', err);
    }
  }

  // Upload new image if provided
  if (imageFile && imageFile.size > 0) {
    // Delete old image if exists
    if (existing.image_url) {
      try {
        const urlParts = existing.image_url.split('/');
        const filepath = urlParts.slice(-2).join('/');
        await adminClient.storage.from('product-images').remove([filepath]);
      } catch (err) {
        console.error('Failed to delete old image:', err);
      }
    }

    const timestamp = Date.now();
    const ext = imageFile.name.split('.').pop() || 'png';
    const safeName = imageFile.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50) || 'image';
    const filename = `${user.id}/${timestamp}-${safeName}.${ext}`;

    const { data, error: uploadError } = await adminClient.storage
      .from('product-images')
      .upload(filename, imageFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from('product-images')
      .getPublicUrl(data.path);

    imageUrl = urlData.publicUrl;
  }

  // Update product
  const { data, error } = await supabase
    .from('products')
    .update({
      name: validated.name,
      description: validated.description || null,
      barcode: validated.barcode || null,
      sku: validated.sku || null,
      unit_name: validated.unit_name || null,
      price: validated.price,
      cost: validated.cost || null,
      stock: validated.stock,
      low_stock_threshold: validated.low_stock_threshold,
      category_id: validated.category_id || null,
      image_url: imageUrl,
      tax_type: validated.tax_type,
      is_active: validated.is_active,
      product_code: product_code || null,
      whole_sell_price: whole_sell_price ?? 0,
      purchase_price: purchase_price ?? 0,
      vendor_id: vendor_id || null,
      depot_id: depot_id || null,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update product: ${error.message}`);
  }

  revalidatePath('/dashboard/products');
  revalidatePath(`/dashboard/products/${id}`);
  return data as Product;
}

/**
 * Soft delete a product (set is_active = false)
 */
export async function deleteProduct(id: string, hardDelete = false) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  if (hardDelete) {
    // Hard delete
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  } else {
    // Soft delete
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  revalidatePath('/dashboard/products');
}
