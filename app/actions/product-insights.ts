'use server';

import { createServerClient } from '@/lib/supabase/server';

export type ProductSalesLine = {
  order_code: string;
  advance_date: string | null;
  qty: number;
  unit_price: number;
  subtotal: number;
  member_name: string | null;
  created_at: string;
};

/** INT-009：商品關聯的客戶訂單明細（近 N 筆） */
export async function fetchProductSalesHistory(productId: string, limit = 30): Promise<ProductSalesLine[]> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('customer_order_items')
    .select(
      `
      qty, unit_price, subtotal, created_at,
      customer_orders!inner (
        order_code, advance_date, user_id,
        members ( name )
      )
    `
    )
    .eq('product_id', productId)
    .eq('customer_orders.user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('fetchProductSalesHistory', error);
    return [];
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const o = row.customer_orders as Record<string, unknown>;
    const rawM = o?.members as { name?: string } | { name?: string }[] | null | undefined;
    const memberName = Array.isArray(rawM) ? rawM[0]?.name ?? null : rawM?.name ?? null;
    return {
      order_code: String(o?.order_code ?? ''),
      advance_date: (o?.advance_date as string | null) ?? null,
      qty: Number(row.qty ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      subtotal: Number(row.subtotal ?? 0),
      member_name: memberName,
      created_at: String(row.created_at ?? ''),
    };
  });
}
