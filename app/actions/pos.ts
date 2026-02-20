/**
 * POS Server Actions
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types/pos';

export async function fetchProductByBarcode(_barcode: string): Promise<Product | null> {
  return null;
}

export async function fetchPosCategories(): Promise<{ id: string; name: string; parent_id: string | null }[]> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from('categories').select('id, name, parent_id').eq('user_id', user.id).order('sort_order');
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, parent_id: r.parent_id ?? null }));
}

export async function fetchPosProducts(_categoryId?: string | null, _search?: string): Promise<Product[]> {
  return [];
}

export async function createPosOrder(
  _paymentMethod: string,
  _items: unknown[],
  _discountAmount?: number
): Promise<{ orderId: string; orderNumber: string } | { error: string }> {
  return { error: 'Not implemented' };
}