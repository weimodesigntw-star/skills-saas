'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { PurchaseOrderFormValues } from '@/lib/schemas/purchase-order';

export async function fetchPurchaseOrders(params?: {
  vendorId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { purchases: [], total: 0, page: 1, pageSize: 20 };

  const { vendorId, status, dateFrom, dateTo, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('purchase_orders')
    .select('*, vendors(id, vendor_code, vendor_name)', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (vendorId) query = query.eq('vendor_id', vendorId);
  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('receive_day', dateFrom);
  if (dateTo) query = query.lte('receive_day', dateTo);

  const { data, count, error } = await query;
  if (error) return { purchases: [], total: 0, page, pageSize };
  return { purchases: data ?? [], total: count ?? 0, page, pageSize };
}

export async function fetchPurchaseOrderById(id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: purchase, error } = await supabase
    .from('purchase_orders')
    .select('*, vendors(id, vendor_code, vendor_name)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !purchase) return null;

  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_id', id)
    .order('created_at');

  return { ...purchase, items: items ?? [] };
}

export async function getPurchaseCodePreview(): Promise<string | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('generate_purchase_code', {
    p_user_id: user.id,
    p_prefix: 'CA202',
  });
  if (error || data == null) return null;
  return typeof data === 'string' ? data : String(data);
}

export async function createPurchaseOrder(values: PurchaseOrderFormValues) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const vendorId = values.vendor_id || null;
  let vendorName = '';
  if (vendorId) {
    const { data: v } = await supabase.from('vendors').select('vendor_name').eq('id', vendorId).single();
    vendorName = (v as any)?.vendor_name ?? '';
  }

  const p_items = values.items.map((i) => ({
    product_id: i.product_id || null,
    product_code: i.product_code || null,
    product_name: i.product_name,
    unit_name: i.unit_name || null,
    qty: i.qty,
    unit_price: i.unit_price,
  }));

  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_user_id: user.id,
    p_vendor_id: vendorId,
    p_vendor_name: vendorName,
    p_receive_day: values.receive_day || null,
    p_depot_id: values.depot_id || null,
    p_tax_type: values.tax_type ?? '稅內含',
    p_taxrate: values.taxrate ?? 0.05,
    p_items,
    p_note: values.note?.trim() || null,
  });

  if (error) return { error: error.message || '建立採購單失敗' };
  const result = data as { purchase_id: string; receive_code: string } | null;
  if (!result) return { error: '建立採購單失敗' };

  revalidatePath('/dashboard/purchases');
  revalidatePath(`/dashboard/purchases/${result.purchase_id}`);
  return { success: true, purchaseId: result.purchase_id, receiveCode: result.receive_code };
}

export async function payPurchaseOrder(id: string, amt: number) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { data: row, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('amt_paid, amt_unpaid')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !row) return { error: '找不到採購單' };
  const currentUnpaid = Number(row.amt_unpaid) ?? 0;
  if (currentUnpaid <= 0) return { error: '已無未付金額' };
  const addPaid = Math.min(amt, currentUnpaid);
  const newPaid = Number(row.amt_paid) + addPaid;
  const newUnpaid = currentUnpaid - addPaid;

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({ amt_paid: newPaid, amt_unpaid: newUnpaid })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) return { error: '更新失敗' };
  revalidatePath('/dashboard/purchases');
  revalidatePath(`/dashboard/purchases/${id}`);
  return { success: true };
}

export async function voidPurchaseOrder(id: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const { data: purchase, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !purchase) return { error: '找不到採購單' };
  if (purchase.status === 'void') return { error: '此採購單已作廢' };

  const { data: items } = await supabase
    .from('purchase_order_items')
    .select('product_id, qty')
    .eq('purchase_id', id);

  for (const item of items ?? []) {
    if (item.product_id) {
      const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
      if (prod) {
        const newStock = Math.max(0, (Number(prod.stock) ?? 0) - Number(item.qty));
        await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);
      }
    }
  }

  const { error: updateError } = await supabase
    .from('purchase_orders')
    .update({ status: 'void' })
    .eq('id', id)
    .eq('user_id', user.id);

  if (updateError) return { error: '作廢失敗' };
  revalidatePath('/dashboard/purchases');
  return { success: true };
}
