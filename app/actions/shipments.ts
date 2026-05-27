'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { ShipmentFormValues } from '@/lib/schemas/shipment';
import { getAuthAndWorkspace } from '@/lib/workspace';

export async function fetchShipments(params?: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
  page?: number;
  pageSize?: number;
}) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { shipments: [], total: 0, page: 1, pageSize: 20 };

  const { status, dateFrom, dateTo, memberId, page = 1, pageSize = 20 } = params ?? {};
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('shipments')
    .select('*, members(id, name, client_code)', { count: 'exact' })
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('ship_date', dateFrom);
  if (dateTo) query = query.lte('ship_date', dateTo);
  if (memberId) query = query.eq('member_id', memberId);

  const { data, count, error } = await query;
  if (error) return { shipments: [], total: 0, page, pageSize };
  return { shipments: data ?? [], total: count ?? 0, page, pageSize };
}

export async function fetchShipmentById(id: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;

  const { data: shipment, error: shipError } = await supabase
    .from('shipments')
    .select('*, members(id, name, client_code)')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  if (shipError || !shipment) return null;

  const { data: items } = await supabase
    .from('shipment_items')
    .select('*')
    .eq('shipment_id', id)
    .order('created_at');

  return { ...shipment, items: items ?? [] };
}

export async function createShipmentFromOrder(
  orderId: string,
  formValues: { ship_date?: string; depot_id?: string; note?: string; items: { order_item_id: string; product_id: string; qty: number; unit_price: number }[] }
) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const p_items = formValues.items.map((i) => ({
    order_item_id: i.order_item_id,
    product_id: i.product_id,
    qty: i.qty,
    unit_price: i.unit_price,
  }));
  const p_ship_date = formValues.ship_date || null;
  const p_depot_id = formValues.depot_id || null;
  const p_note = formValues.note?.trim() || null;

  const { data, error } = await supabase.rpc('create_shipment_from_order', {
    p_user_id: ownerId,
    p_order_id: orderId,
    p_ship_date: p_ship_date,
    p_depot_id: p_depot_id,
    p_items: p_items,
    p_note: p_note,
  });

  if (error) return { error: error.message || '建立出貨單失敗' };
  const result = data as { shipment_id: string; ship_code: string } | null;
  if (!result) return { error: '建立出貨單失敗' };

  revalidatePath('/dashboard/shipments');
  revalidatePath(`/dashboard/shipments/${result.shipment_id}`);
  revalidatePath('/dashboard/orders');
  revalidatePath(`/dashboard/orders/${orderId}`);
  return { success: true, shipmentId: result.shipment_id, shipCode: result.ship_code };
}

export async function createShipmentManual(values: ShipmentFormValues) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: shipCodeData, error: codeError } = await supabase.rpc('generate_ship_code', {
    p_user_id: ownerId,
    p_prefix: 'BA202',
  });
  if (codeError || shipCodeData == null) return { error: '產生出貨單號失敗' };
  const shipCode = typeof shipCodeData === 'string' ? shipCodeData : String(shipCodeData);

  const subtotal = values.items.reduce(
    (s, i) => s + (Number(i.qty) * Number(i.unit_price)),
    0
  );
  const taxrate = 0.05;
  const tax_amount = +(subtotal * (taxrate / (1 + taxrate))).toFixed(2);
  const total = subtotal;

  const { data: shipment, error: shipError } = await supabase
    .from('shipments')
    .insert({
      user_id: ownerId,
      ship_code: shipCode,
      ship_date: values.ship_date || null,
      depot_id: values.depot_id || null,
      note: values.note?.trim() || null,
      currency: '台幣',
      tax_type: '稅內含',
      taxrate,
      subtotal,
      tax_amount,
      total,
      amt_outstanding: total,
      status: 'valid',
    })
    .select('id')
    .single();

  if (shipError || !shipment) return { error: '建立出貨單失敗' };

  const itemsToInsert = values.items.map((i) => ({
    shipment_id: shipment.id,
    product_id: i.product_id || null,
    product_code: i.product_code || null,
    product_name: i.product_name,
    unit_name: i.unit_name || null,
    qty: i.qty,
    unit_price: i.unit_price,
    subtotal: Number(i.qty) * Number(i.unit_price),
  }));

  const { error: itemsError } = await supabase.from('shipment_items').insert(itemsToInsert);
  if (itemsError) return { error: '建立出貨明細失敗' };

  for (const item of values.items) {
    if (!item.product_id) continue;
    await supabase.rpc('adjust_inventory', {
      p_product_id: item.product_id,
      p_user_id: ownerId,
      p_type: 'ship',
      p_qty: Math.max(0, Math.floor(Number(item.qty) || 0)),
      p_note: `手動出貨扣庫（${shipCode}）`,
      p_depot_id: values.depot_id || null,
    });
  }

  revalidatePath('/dashboard/shipments');
  revalidatePath('/dashboard/inventory');
  return { success: true, shipmentId: shipment.id, shipCode };
}

export async function receivePayment(
  shipmentId: string,
  amt: number,
  note?: string
) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: row, error: fetchError } = await supabase
    .from('shipments')
    .select('amt_recd, amt_outstanding')
    .eq('id', shipmentId)
    .eq('user_id', ownerId)
    .single();

  if (fetchError || !row) return { error: '找不到出貨單' };

  const currentRecd = Number(row.amt_recd) ?? 0;
  const currentOut = Number(row.amt_outstanding) ?? 0;
  if (currentOut <= 0) return { error: '已無未收金額' };

  const addRecd = Math.min(amt, currentOut);
  const newRecd = currentRecd + addRecd;
  const newOut = currentOut - addRecd;

  const { error: updateError } = await supabase
    .from('shipments')
    .update({ amt_recd: newRecd, amt_outstanding: newOut })
    .eq('id', shipmentId)
    .eq('user_id', ownerId);

  if (updateError) return { error: '更新失敗' };
  revalidatePath('/dashboard/shipments');
  revalidatePath(`/dashboard/shipments/${shipmentId}`);
  return { success: true };
}

export async function voidShipment(shipmentId: string) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select('id, status, source_order_id, depot_id')
    .eq('id', shipmentId)
    .eq('user_id', ownerId)
    .single();

  if (fetchError || !shipment) return { error: '找不到出貨單' };
  if (shipment.status === 'void') return { error: '此出貨單已作廢' };

  const { data: items } = await supabase
    .from('shipment_items')
    .select('id, order_item_id, product_id, qty')
    .eq('shipment_id', shipmentId);

  for (const item of items ?? []) {
    if (item.product_id) {
      await supabase.rpc('adjust_inventory', {
        p_product_id: item.product_id,
        p_user_id: ownerId,
        p_type: 'restock',
        p_qty: Math.max(0, Math.floor(Number(item.qty) || 0)),
        p_note: '出貨單作廢回補',
        p_depot_id: (shipment as { depot_id?: string | null }).depot_id ?? null,
      });
    }
    if (item.order_item_id) {
      const { data: oi } = await supabase.from('customer_order_items').select('shipped_qty').eq('id', item.order_item_id).single();
      if (oi) {
        const newShipped = Math.max(0, (Number(oi.shipped_qty) ?? 0) - Number(item.qty));
        await supabase.from('customer_order_items').update({ shipped_qty: newShipped }).eq('id', item.order_item_id);
      }
    }
  }

  const { error: updateError } = await supabase
    .from('shipments')
    .update({ status: 'void' })
    .eq('id', shipmentId)
    .eq('user_id', ownerId);

  if (updateError) return { error: '作廢失敗' };

  if (shipment.source_order_id) {
    await supabase.from('customer_orders').update({ status: 'pending' }).eq('id', shipment.source_order_id).eq('user_id', ownerId);
  }

  revalidatePath('/dashboard/shipments');
  revalidatePath(`/dashboard/shipments/${shipmentId}`);
  revalidatePath('/dashboard/orders');
  revalidatePath('/dashboard/inventory');
  return { success: true };
}
