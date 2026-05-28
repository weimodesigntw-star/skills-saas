import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';

type EasyStoreOrder = Record<string, any>;

function mapShippingStatus(fulfillmentStatus: unknown) {
  const status = String(fulfillmentStatus ?? '').toLowerCase();
  if (status.includes('partial')) return 'partial';
  if (status.includes('ship') || status.includes('fulfill') || status === 'fulfilled') return 'shipped';
  return 'pending';
}

function isPaidEasyStoreOrder(order: EasyStoreOrder) {
  const status = String(order.financial_status ?? '').toLowerCase();
  return status === 'paid' || status === 'partially_refunded';
}

function getLineItemShippedQty(order: EasyStoreOrder, lineItem: Record<string, any>, qty: number) {
  const directValue =
    lineItem.shipped_quantity ??
    lineItem.shipped_qty ??
    lineItem.fulfilled_quantity ??
    lineItem.fulfilled_qty ??
    lineItem.quantity_fulfilled;
  const directQty = Number(directValue);
  if (Number.isFinite(directQty) && directQty > 0) {
    return Math.max(0, Math.min(qty, directQty));
  }

  return mapShippingStatus(order.fulfillment_status) === 'shipped' ? qty : 0;
}

function getLineItemProductName(lineItem: Record<string, any>) {
  const productName = String(lineItem.product_name ?? lineItem.name ?? lineItem.title ?? '').trim();
  const variantName = String(lineItem.variant_name ?? '').trim();
  if (productName && variantName) return `${productName} - ${variantName}`;
  return productName || variantName || '(未命名商品)';
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLineItemNetTotal(lineItem: Record<string, any>, qty: number) {
  const unitPrice = toFiniteNumber(lineItem.price ?? lineItem.unit_price, 0);
  const grossTotal = toFiniteNumber(lineItem.subtotal, qty * unitPrice);
  const totalAmount = toFiniteNumber(lineItem.total_amount, NaN);

  if (Number.isFinite(totalAmount)) {
    return Math.max(0, totalAmount);
  }

  const itemDiscount = toFiniteNumber(lineItem.total_discount, 0);
  const orderDiscount = toFiniteNumber(lineItem.allocated_order_level_discount, 0);
  return Math.max(0, grossTotal - itemDiscount - orderDiscount);
}

function getLineItemUnitPrice(lineItem: Record<string, any>, qty: number) {
  const unitPrice = toFiniteNumber(lineItem.price ?? lineItem.unit_price, 0);
  if (qty <= 0) return unitPrice;
  return Math.round(getLineItemNetTotal(lineItem, qty) / qty);
}

function buildMemberRowFromEasyStoreCustomer(customer: Record<string, any>, userId: string) {
  const fallbackName = `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
  const row: Record<string, any> = {
    user_id: userId,
    easystore_customer_id: String(customer.id),
    name: (customer.name ?? customer.full_name ?? fallbackName) || '(未命名客戶)',
    email: customer.email ?? null,
    phone: customer.phone ?? customer.mobile ?? null,
  };

  if (customer.birthday ?? customer.birthdate) row.birthday = customer.birthday ?? customer.birthdate;
  if (customer.state !== undefined) row.is_active = customer.state === 'enabled';
  if (customer.tags ?? customer.customer_tags) {
    const tags = customer.tags ?? customer.customer_tags;
    row.client_cat = Array.isArray(tags) ? tags.map(String).join(', ') : String(tags);
  }

  return row;
}

async function upsertMemberFromEasyStoreCustomer(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  customer: Record<string, any> | null | undefined
) {
  if (!customer?.id) return null;

  const row = buildMemberRowFromEasyStoreCustomer(customer, userId);
  const { data, error } = await admin
    .from('members')
    .upsert(row, { onConflict: 'easystore_customer_id,user_id' })
    .select('id')
    .maybeSingle();

  if (!error && data?.id) return data.id as string;

  const { data: member } = await admin
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .eq('easystore_customer_id', String(customer.id))
    .maybeSingle();

  return (member?.id as string | undefined) ?? null;
}

async function buildEasyStoreProductIdMap(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  easystoreProductIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(easystoreProductIds.map((s) => String(s).trim()).filter(Boolean))];
  const map: Record<string, string> = {};
  const CHUNK = 150;
  for (let j = 0; j < unique.length; j += CHUNK) {
    const chunk = unique.slice(j, j + CHUNK);
    const { data } = await admin
      .from('products')
      .select('id, easystore_product_id')
      .eq('user_id', userId)
      .in('easystore_product_id', chunk);
    for (const row of data ?? []) {
      const id = row.easystore_product_id as string | null;
      if (id && row.id && map[id] == null) map[id] = row.id as string;
    }
  }
  return map;
}

/** ES-003：依 EasyStore product_id / SKU 對應本地 products.id */
async function buildSkuToProductIdMap(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  skus: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))];
  const map: Record<string, string> = {};
  const CHUNK = 150;
  for (let j = 0; j < unique.length; j += CHUNK) {
    const chunk = unique.slice(j, j + CHUNK);
    const { data } = await admin
      .from('products')
      .select('id, product_code')
      .eq('user_id', userId)
      .in('product_code', chunk);
    for (const row of data ?? []) {
      const code = row.product_code as string | null;
      if (code && row.id && map[code] == null) map[code] = row.id as string;
    }
  }
  return map;
}

async function recalcMemberStatsForMemberIds(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  memberIds: string[]
) {
  if (memberIds.length === 0) return;

  const uniqueIds = [...new Set(memberIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  const { data: orders, error } = await admin
    .from('customer_orders')
    .select('member_id, total')
    .eq('user_id', userId)
    .in('member_id', uniqueIds);

  if (error) return;

  const stats: Record<string, { total: number; count: number }> = {};
  for (const id of uniqueIds) stats[id] = { total: 0, count: 0 };

  for (const row of orders ?? []) {
    const mid = row.member_id as string | null;
    if (!mid || !stats[mid]) continue;
    stats[mid].total += Number(row.total ?? 0);
    stats[mid].count += 1;
  }

  const isMissingOrderCountColumn = (error: unknown) => {
    const message = String((error as { message?: string })?.message ?? '').toLowerCase();
    return message.includes('order_count') && message.includes('column');
  };

  for (const id of uniqueIds) {
    const s = stats[id] ?? { total: 0, count: 0 };
    let { error } = await admin
      .from('members')
      .update({
        total_spent: Number(s.total.toFixed(2)),
        order_count: s.count,
        visit_count: s.count,
      })
      .eq('user_id', userId)
      .eq('id', id);

    if (error && isMissingOrderCountColumn(error)) {
      ({ error } = await admin
        .from('members')
        .update({
          total_spent: Number(s.total.toFixed(2)),
          visit_count: s.count,
        })
        .eq('user_id', userId)
        .eq('id', id));
    }
  }
}

export async function POST(req: NextRequest) {
  let mode: 'incremental' | 'full' = 'incremental';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === 'full') mode = 'full';
  } catch {
    // ignore
  }

  const supabase = createServerClient();

  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: integration, error: integErr } = await admin
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', ownerId)
    .maybeSingle();

  if (integErr) {
    return NextResponse.json({ error: integErr.message }, { status: 500 });
  }

  if (!integration?.access_token) {
    return NextResponse.json({ error: '尚未連結 EasyStore' }, { status: 400 });
  }

  const { shop, access_token } = integration as { shop: string; access_token: string };

  let sinceDate: string | null = null;
  if (mode === 'incremental') {
    const { data: syncState } = await admin
      .from('easystore_sync_state')
      .select('last_synced_at')
      .eq('user_id', ownerId)
      .eq('resource', 'orders')
      .maybeSingle();
    sinceDate = (syncState?.last_synced_at as string | null) ?? null;
  }
  const syncStartedAt = new Date().toISOString();

  let allOrders: EasyStoreOrder[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    let url = `https://${shop}/api/3.0/orders.json?page=${page}&limit=${limit}`;
    if (sinceDate) {
      url += `&updated_at_min=${encodeURIComponent(sinceDate)}`;
    }

    const res = await fetch(url, {
      headers: {
        'Easystore-Access-Token': access_token,
      },
    });

    if (!res.ok) {
      const bodyHead = (await res.text().catch(() => '')).slice(0, 300);
      return NextResponse.json(
        {
          error: 'EasyStore orders API 呼叫失敗',
          status: res.status,
          bodyHead,
          url,
        },
        { status: 502 }
      );
    }

    const json: any = await res.json();

    // eslint-disable-next-line no-console
    console.log(
      '[EasyStore] orders page',
      page,
      'raw keys:',
      Object.keys(json),
      'json(head):',
      JSON.stringify(json).substring(0, 500)
    );

    const orders: EasyStoreOrder[] = json.orders ?? [];
    if (orders.length === 0) break;

    allOrders = allOrders.concat(orders);

    const totalCount = json.total_count ?? json.total ?? null;
    const pageCount = json.page_count ?? null;

    if (totalCount !== null && allOrders.length >= totalCount) break;
    if (pageCount !== null && page >= pageCount) break;
    if (orders.length < limit) break;

    page++;
  }

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  const paidOrders = allOrders.filter(isPaidEasyStoreOrder);
  const skippedUnpaid = allOrders.length - paidOrders.length;

  const BATCH = 50;
  const touchedMemberIds = new Set<string>();

  for (let i = 0; i < paidOrders.length; i += BATCH) {
    const batch = paidOrders.slice(i, i + BATCH);

    const skusInBatch: string[] = [];
    const easystoreProductIdsInBatch: string[] = [];
    for (const o of batch) {
      for (const li of o.line_items ?? []) {
        if (li.sku != null && String(li.sku).trim()) skusInBatch.push(String(li.sku).trim());
        if (li.product_id != null && String(li.product_id).trim()) easystoreProductIdsInBatch.push(String(li.product_id).trim());
      }
    }
    const easystoreProductIdMap = await buildEasyStoreProductIdMap(admin, ownerId, easystoreProductIdsInBatch);
    const skuToProductId = await buildSkuToProductIdMap(admin, ownerId, skusInBatch);

    // 先準備要 upsert 的 customer_orders 以及 items
    const orderRows: any[] = [];
    const itemRows: any[] = [];

    for (const o of batch) {
      const easystoreOrderId = String(o.id);
      const orderTotal = Number(o.total_amount ?? o.total_price ?? 0);
      const subtotal = Number(o.subtotal_price ?? orderTotal);

      const shippingStatus = mapShippingStatus(o.fulfillment_status);

      let memberId: string | null = null;
      const customerId = o.customer?.id;
      if (customerId) {
        memberId = await upsertMemberFromEasyStoreCustomer(admin, ownerId, o.customer);
        if (memberId) touchedMemberIds.add(memberId);
      }

      orderRows.push({
        user_id: ownerId,
        easystore_order_id: easystoreOrderId,
        order_code: o.number ?? String(o.id),
        advance_date: o.created_at ?? o.processed_at ?? null,
        member_id: memberId,
        currency: o.currency ?? '台幣',
        tax_type: '稅內含',
        taxrate: 0.05,
        subtotal,
        tax_amount: Number((orderTotal - subtotal).toFixed(2)),
        total: orderTotal,
        sales_channel: o.sales_channel ?? 'EasyStore',
        note: o.note ?? null,
        status: shippingStatus,
      });

      const lineItems: any[] = o.line_items ?? [];
      for (const li of lineItems) {
        const qty = Number(li.quantity ?? li.qty ?? 0);
        const unitPrice = getLineItemUnitPrice(li, qty);
        const subtotalItem = Math.round(getLineItemNetTotal(li, qty));
        const sku = li.sku != null ? String(li.sku).trim() : '';
        const easystoreProductId = li.product_id != null ? String(li.product_id).trim() : '';
        const productId =
          (easystoreProductId && easystoreProductIdMap[easystoreProductId]) ||
          (sku && skuToProductId[sku]) ||
          null;

        itemRows.push({
          _easystore_order_id: easystoreOrderId,
          easystore_line_item_id: String(li.id ?? ''),
          product_id: productId,
          product_code: li.sku ?? null,
          product_name: getLineItemProductName(li),
          unit_name: li.unit ?? null,
          qty,
          shipped_qty: getLineItemShippedQty(o, li, qty),
          unit_price: unitPrice,
          discount_pct: 100,
          subtotal: subtotalItem,
          note: li.note ?? null,
        });
      }
    }

    // 先 upsert 訂單主檔
    const { data: upsertedOrders, error: ordersError } = await admin
      .from('customer_orders')
      .upsert(orderRows, {
        onConflict: 'user_id,easystore_order_id',
      })
      .select('id, easystore_order_id');

    if (ordersError) {
      failed += batch.length;
      errors.push(`orders batch ${i}-${i + batch.length}: ${ordersError.message}`);
      // eslint-disable-next-line no-console
      console.error('[EasyStore] customer_orders upsert error', {
        batchRange: `${i}-${i + batch.length}`,
        message: ordersError.message,
        code: (ordersError as any).code,
        details: (ordersError as any).details,
        hint: (ordersError as any).hint,
      });
      continue;
    }

    const idByEasystore: Record<string, string> = {};
    for (const row of upsertedOrders ?? []) {
      idByEasystore[row.easystore_order_id] = row.id;
    }

    // 重新掛上 order_id
    const itemsToInsert = itemRows
      .map((item) => {
        const orderId = idByEasystore[item._easystore_order_id as string];
        if (!orderId) return null;
        const { _easystore_order_id, ...cleanItem } = item;
        return { ...cleanItem, order_id: orderId };
      })
      .filter(Boolean) as any[];

    // 先刪除這一批 Easystore 訂單對應的舊明細，再重新插入
    const easystoreIdsInBatch = batch.map((o) => String(o.id));

    const { data: existingOrders } = await admin
      .from('customer_orders')
      .select('id')
      .eq('user_id', ownerId)
      .in('easystore_order_id', easystoreIdsInBatch);

    const orderIdsToClear = (existingOrders ?? []).map((o) => o.id);
    if (orderIdsToClear.length > 0) {
      await admin.from('customer_order_items').delete().in('order_id', orderIdsToClear);
    }

    if (itemsToInsert.length > 0) {
      const { error: itemsError } = await admin.from('customer_order_items').insert(itemsToInsert);
      if (itemsError) {
        errors.push(`items batch ${i}-${i + batch.length}: ${itemsError.message}`);
        // eslint-disable-next-line no-console
        console.error('[EasyStore] customer_order_items insert error', {
          batchRange: `${i}-${i + batch.length}`,
          message: itemsError.message,
          code: (itemsError as any).code,
          details: (itemsError as any).details,
          hint: (itemsError as any).hint,
        });
      }
    }

    synced += batch.length;
  }

  await recalcMemberStatsForMemberIds(admin, ownerId, Array.from(touchedMemberIds));

  await admin
    .from('easystore_sync_state')
    .upsert(
      {
        user_id: ownerId,
        resource: 'orders',
        last_synced_at: syncStartedAt,
        synced_count: synced,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,resource' }
    );

  return NextResponse.json({
    mode,
    since: sinceDate,
    total: allOrders.length,
    skippedUnpaid,
    synced,
    failed,
    errors,
  });
}
