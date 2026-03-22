import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type EasyStoreOrder = Record<string, any>;

/** ES-003：依 SKU（product_code）對應本地 products.id */
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: integration, error: integErr } = await admin
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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

  const BATCH = 50;
  const touchedMemberIds = new Set<string>();

  for (let i = 0; i < allOrders.length; i += BATCH) {
    const batch = allOrders.slice(i, i + BATCH);

    const skusInBatch: string[] = [];
    for (const o of batch) {
      for (const li of o.line_items ?? []) {
        if (li.sku != null && String(li.sku).trim()) skusInBatch.push(String(li.sku).trim());
      }
    }
    const skuToProductId = await buildSkuToProductIdMap(admin, user.id, skusInBatch);

    // 先準備要 upsert 的 customer_orders 以及 items
    const orderRows: any[] = [];
    const itemRows: any[] = [];

    for (const o of batch) {
      const easystoreOrderId = String(o.id);
      const orderTotal = Number(o.total_amount ?? o.total_price ?? 0);
      const subtotal = Number(o.subtotal_price ?? orderTotal);

      const financialStatus = o.financial_status ?? o.payment_status ?? 'pending';

      let memberId: string | null = null;
      const customerId = o.customer?.id;
      if (customerId) {
        const { data: member } = await admin
          .from('members')
          .select('id')
          .eq('user_id', user.id)
          .eq('easystore_customer_id', String(customerId))
          .maybeSingle();
        memberId = member?.id ?? null;
        if (memberId) touchedMemberIds.add(memberId);
      }

      orderRows.push({
        user_id: user.id,
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
        status: financialStatus,
      });

      const lineItems: any[] = o.line_items ?? [];
      for (const li of lineItems) {
        const qty = Number(li.quantity ?? li.qty ?? 0);
        const unitPrice = Number(li.price ?? li.unit_price ?? 0);
        const subtotalItem = qty * unitPrice;
        const sku = li.sku != null ? String(li.sku).trim() : '';
        const productId = sku && skuToProductId[sku] ? skuToProductId[sku] : null;

        itemRows.push({
          _easystore_order_id: easystoreOrderId,
          easystore_line_item_id: String(li.id ?? ''),
          product_id: productId,
          product_code: li.sku ?? null,
          product_name: li.name ?? '(未命名商品)',
          unit_name: li.unit ?? null,
          qty,
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
      .eq('user_id', user.id)
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

  await recalcMemberStatsForMemberIds(admin, user.id, Array.from(touchedMemberIds));

  await admin
    .from('easystore_sync_state')
    .upsert(
      {
        user_id: user.id,
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
    synced,
    failed,
    errors,
  });
}

