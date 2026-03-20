/**
 * 本機同步 EasyStore 訂單到 Supabase customer_orders / customer_order_items
 *
 * 用法（請先在 .env.local 設定 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY）：
 *
 *   cd ~/Downloads/skills
 *   IMPORT_USER_ID="d290b3c9-8639-43bc-84f1-428a1bd4cdf4" \
 *     npx tsx scripts/sync-easystore-orders.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const USER_ID = process.env.IMPORT_USER_ID!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !USER_ID) {
    console.error(
      '缺少環境變數：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / IMPORT_USER_ID',
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log('使用 USER_ID =', USER_ID);

  // 1) 取得 EasyStore integration（shop + access_token）
  const { data: integration, error: integErr } = await supabase
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', USER_ID)
    .maybeSingle();

  if (integErr) {
    console.error('讀取 easystore_integrations 失敗：', integErr.message);
    process.exit(1);
  }
  if (!integration) {
    console.error('找不到該 USER_ID 的 EasyStore integration，請先在前台完成連結。');
    process.exit(1);
  }

  const { shop, access_token } = integration as {
    shop: string;
    access_token: string;
  };

  console.log('使用 shop =', shop);

  // 2) 建立 Easystore customer → member.id 的對照表（加速後續查詢）
  const { data: members, error: membersErr } = await supabase
    .from('members')
    .select('id, easystore_customer_id')
    .eq('user_id', USER_ID)
    .not('easystore_customer_id', 'is', null);

  if (membersErr) {
    console.error('讀取 members 失敗：', membersErr.message);
    process.exit(1);
  }

  const customerMap = new Map<string, string>();
  for (const m of members ?? []) {
    if (m.easystore_customer_id) {
      customerMap.set(String(m.easystore_customer_id), m.id as string);
    }
  }
  console.log('已載入 members 對照表：', customerMap.size, '筆');

  // 3) 分頁拉 EasyStore orders
  let page = 1;
  const limit = 50;
  let allOrders: any[] = [];

  while (true) {
    const url = `https://${shop}/api/3.0/orders.json?page=${page}&limit=${limit}`;
    console.log('抓取訂單頁面：', url);

    const res = await fetch(url, {
      headers: {
        'Easystore-Access-Token': access_token,
      },
    });

    if (!res.ok) {
      const bodyHead = (await res.text().catch(() => '')).slice(0, 300);
      console.error('EasyStore orders API 失敗：', res.status, bodyHead);
      process.exit(1);
    }

    const json: any = await res.json();
    const orders = json.orders ?? [];
    const totalCount = json.total_count ?? json.total ?? null;
    const pageCount = json.page_count ?? null;

    console.log(
      `Page ${page}/${pageCount ?? '?'}: 本頁 ${orders.length} 筆，累積 ${
        allOrders.length + orders.length
      } / ${totalCount ?? '?'}`
    );

    allOrders = allOrders.concat(orders);

    if (orders.length === 0) break;
    if (totalCount !== null && allOrders.length >= totalCount) break;
    if (pageCount !== null && page >= pageCount) break;
    if (orders.length < limit) break;

    page++;
  }

  console.log('\n共抓到訂單筆數：', allOrders.length);

  // 4) 寫入 Supabase：批次 upsert 訂單 + 批次刪除/插入明細
  const BATCH = 80;
  let synced = 0;
  let failed = 0;

  for (let i = 0; i < allOrders.length; i += BATCH) {
    const batch = allOrders.slice(i, i + BATCH);

    const orderRows = batch.map((o) => {
      const easystoreOrderId = String(o.id);
      const totalRaw = o.total_amount ?? o.total_price ?? 0;
      const orderTotal = Number(totalRaw) || 0;
      const subtotalRaw = o.subtotal_price ?? orderTotal;
      const subtotal = Number(subtotalRaw) || 0;
      const taxAmount = +(orderTotal - subtotal).toFixed(2);
      const financialStatus = o.financial_status ?? o.payment_status ?? 'pending';
      let memberId: string | null = null;
      if (o.customer?.id) memberId = customerMap.get(String(o.customer.id)) ?? null;

      return {
        user_id: USER_ID,
        easystore_order_id: easystoreOrderId,
        order_code: o.number ?? String(o.id),
        advance_date: o.processed_at ?? o.created_at ?? null,
        member_id: memberId,
        currency: o.currency ?? '台幣',
        tax_type: '稅內含',
        taxrate: 0.05,
        subtotal,
        tax_amount: taxAmount,
        total: orderTotal,
        sales_channel: o.sales_channel ?? 'EasyStore',
        note: o.note ?? null,
        status: financialStatus,
      };
    });

    const { error: orderErr } = await supabase
      .from('customer_orders')
      .upsert(orderRows, { onConflict: 'user_id,easystore_order_id' });

    if (orderErr) {
      console.error('訂單批次 upsert 失敗：', orderErr.message);
      failed += batch.length;
      continue;
    }

    const esIds = batch.map((o) => String(o.id));
    const { data: fetchedOrders } = await supabase
      .from('customer_orders')
      .select('id, easystore_order_id')
      .eq('user_id', USER_ID)
      .in('easystore_order_id', esIds);

    const idByEsId = new Map<string, string>();
    for (const row of fetchedOrders ?? []) {
      idByEsId.set(String(row.easystore_order_id), row.id as string);
    }

    const batchOrderIds = Array.from(idByEsId.values());
    await supabase.from('customer_order_items').delete().in('order_id', batchOrderIds);

    const allItemRows: Array<Record<string, unknown>> = [];
    for (const o of batch) {
      const orderId = idByEsId.get(String(o.id));
      if (!orderId) continue;
      const lineItems: any[] = o.line_items ?? [];
      for (const li of lineItems) {
        const qty = Number(li.quantity ?? li.qty ?? 0) || 0;
        const unitPrice = Number(li.price ?? li.unit_price ?? 0) || 0;
        const subtotalItem =
          Number(li.subtotal ?? li.total_amount ?? qty * unitPrice) || Number((qty * unitPrice).toFixed(2));
        allItemRows.push({
          order_id: orderId,
          easystore_line_item_id: li.id ? String(li.id) : null,
          product_id: null,
          product_code: li.sku ?? null,
          product_name: li.product_name ?? li.name ?? li.title ?? '(未命名商品)',
          unit_name: li.unit ?? null,
          qty,
          unit_price: unitPrice,
          discount_pct: 100,
          subtotal: subtotalItem,
          note: li.note ?? null,
        });
      }
    }

    if (allItemRows.length > 0) {
      const ITEM_CHUNK = 200;
      for (let j = 0; j < allItemRows.length; j += ITEM_CHUNK) {
        const chunk = allItemRows.slice(j, j + ITEM_CHUNK);
        const { error: itemsErr } = await supabase.from('customer_order_items').insert(chunk);
        if (itemsErr) {
          console.error('明細批次插入失敗：', itemsErr.message, itemsErr.code, itemsErr.details);
        }
      }
    }

    synced += batch.length;
    console.log(`目前進度：${synced}/${allOrders.length} 筆`);
  }

  console.log(`\n✅ 完成：${synced} 筆成功，${failed} 筆失敗`);

  // 查詢確認
  const { count: orderCount } = await supabase
    .from('customer_orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', USER_ID)
    .not('easystore_order_id', 'is', null);

  const { data: orderIds } = await supabase
    .from('customer_orders')
    .select('id')
    .eq('user_id', USER_ID)
    .not('easystore_order_id', 'is', null)
    .limit(5000);
  const ids = (orderIds ?? []).map((r) => r.id);
  let itemCount = 0;
  const CHUNK = 200;
  for (let k = 0; k < ids.length; k += CHUNK) {
    const slice = ids.slice(k, k + CHUNK);
    const { count } = await supabase
      .from('customer_order_items')
      .select('*', { count: 'exact', head: true })
      .in('order_id', slice);
    itemCount += count ?? 0;
  }
  console.log('\nSupabase 筆數確認：');
  console.log('  customer_orders (easystore_order_id IS NOT NULL):', orderCount ?? 0);
  console.log('  customer_order_items (上述訂單的明細):', itemCount);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

