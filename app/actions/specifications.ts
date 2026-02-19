'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { SpecificationSchema, Specification, SpecificationQuery } from '@/lib/validations/spec';
import { z } from 'zod';

/**
 * Get specifications for the current user with optional filters
 */
export async function getSpecifications(filters?: Partial<SpecificationQuery>) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  let query = supabase
    .from('specifications')
    .select('*')
    .eq('user_id', user.id);

  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  if (filters?.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }

  // Apply sorting
  const sortBy = filters?.sort_by || 'created_at';
  const sortOrder = filters?.sort_order || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Apply pagination
  const limit = filters?.limit || 20;
  const page = filters?.page || 1;
  const offset = (page - 1) * limit;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch specifications: ${error.message}`);
  }

  return data as Specification[];
}

/**
 * Get a single specification by ID
 */
export async function getSpecification(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data, error } = await supabase
    .from('specifications')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch specification: ${error.message}`);
  }

  if (!data) {
    throw new Error('Specification not found');
  }

  return data as Specification;
}

/**
 * Create a new specification
 */
export async function createSpecification(input: any) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Validate input against Zod schema
  const validated = SpecificationSchema.parse(input);

  const { data, error } = await supabase
    .from('specifications')
    .insert({
      user_id: user.id,
      title: validated.title,
      description: validated.description,
      category: validated.category,
      status: validated.status,
      spec_data: validated.spec_data,
      tags: validated.tags || [],
      metadata: validated.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create specification: ${error.message}`);
  }

  revalidatePath('/dashboard/specifications');
  return data as Specification;
}

/**
 * Update a specification
 */
export async function updateSpecification(id: string, input: any) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from('specifications')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    throw new Error('Specification not found or unauthorized');
  }

  // Validate input against Zod schema
  const validated = SpecificationSchema.parse(input);

  const { data, error } = await supabase
    .from('specifications')
    .update({
      title: validated.title,
      description: validated.description,
      category: validated.category,
      status: validated.status,
      spec_data: validated.spec_data,
      tags: validated.tags || [],
      metadata: validated.metadata || {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update specification: ${error.message}`);
  }

  revalidatePath('/dashboard/specifications');
  revalidatePath(`/dashboard/specifications/${id}`);
  return data as Specification;
}

/**
 * Delete a specification
 */
export async function deleteSpecification(id: string) {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const { error } = await supabase
    .from('specifications')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete specification: ${error.message}`);
  }

  revalidatePath('/dashboard/specifications');
}
