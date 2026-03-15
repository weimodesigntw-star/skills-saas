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

/** 規格建議一項：名稱 + 選項陣列 */
export type SpecSuggestion = { name: string; options: string[] };

/**
 * 呼叫 Gemini 生成規格建議
 */
export async function generateSpecWithAI(
  productName: string,
  categoryName?: string,
  existingSpecs?: string[]
): Promise<{ specs: SpecSuggestion[] } | { error: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) return { error: '未設定 Google AI API Key' };

  try {
    const { generateText } = await import('ai');
    const { google } = await import('@ai-sdk/google');
    const existingHint =
      (existingSpecs?.length ?? 0) > 0
        ? `\n目前已有的規格名稱請勿重複：${existingSpecs!.join('、')}。`
        : '';
    const prompt = `你是商品規格專家。商品名稱：${productName}${categoryName ? `，分類：${categoryName}` : ''}。${existingHint}

請建議 3～5 組規格，每組包含「名稱」與「可選值」陣列。只回傳一個 JSON 陣列，不要其他說明。
格式：[{"name":"規格名稱","options":["選項1","選項2"]}]`;

    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.0-flash-exp';
    const { text } = await generateText({
      model: google(modelName),
      prompt,
      temperature: 0.5,
    });

    const trimmed = text.trim().replace(/^```json?\s*|\s*```$/g, '');
    const parsed = JSON.parse(trimmed) as { name: string; options: string[] }[];
    if (!Array.isArray(parsed)) return { error: 'AI 回傳格式錯誤' };
    const specs = parsed.map((s) => ({
      name: String(s.name ?? ''),
      options: Array.isArray(s.options) ? s.options.map(String) : [],
    }));
    return { specs };
  } catch (e) {
    if (e instanceof SyntaxError) return { error: 'AI 回傳非 JSON' };
    const msg = e instanceof Error ? e.message : 'AI 建議失敗';
    return { error: msg };
  }
}

/** 以「名稱 + 選項」建立一筆規格（寫入 spec_data.fields） */
export async function createSpecificationSimple(
  name: string,
  options: string[],
  category?: string
): Promise<{ id: string } | { error: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  if (!name.trim()) return { error: '規格名稱不可為空' };
  if (!Array.isArray(options) || options.length === 0) return { error: '至少需一個選項' };

  const key = name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'spec';
  const spec_data = {
    version: '1.0.0',
    fields: {
      [key]: {
        key,
        label: name.trim(),
        type: 'select' as const,
        value: options[0] ?? '',
        required: false,
        options: options.map((o) => String(o).trim()).filter(Boolean),
      },
    },
  };

  const { data, error } = await supabase
    .from('specifications')
    .insert({
      user_id: user.id,
      title: name.trim(),
      description: null,
      category: category || null,
      status: 'draft',
      spec_data,
      tags: [],
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/dashboard/specifications');
  return { id: data.id };
}
