import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';
import { extractEasyStoreProductImageUrl } from '@/lib/easystore/extract-product-image-url';

export const runtime = 'nodejs';

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type EasyStoreProduct = Record<string, any>;
type OrderLineItem = { product_id: string | null; qty: number; shipped_qty: number };

/** 與 sync-products 一致：不寫入 product_code / barcode，避免 unique 衝突 */
function toProductRow(p: EasyStoreProduct, userId: string) {
  const variants: any[] = p.variants ?? [];
  const firstVariant = variants[0] ?? {};
  const channelStock = Number(
    p.inventory_quantity ?? firstVariant.inventory_quantity ?? firstVariant.inventory ?? p.inventory ?? 0
  );
  const price = Number(p.price ?? firstVariant.price ?? 0);
  const statusRaw = String(p.status ?? p.state ?? 'active').toLowerCase();
  const isActive = !['archived', 'disabled', 'inactive', 'draft'].includes(statusRaw);

  const imageUrl = extractEasyStoreProductImageUrl(p);

  return {
    user_id: userId,
    easystore_product_id: String(p.id),
    name: p.name ?? p.title ?? '(未命名商品)',
    ...(imageUrl ? { image_url: imageUrl } : {}),
    price,
    channel_stock_easystore: channelStock,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };
}

function tagsToClientCat(data: any): string | null {
  const t = data.tags ?? data.customer_tags;
  if (t == null) return null;
  if (Array.isArray(t)) return t.map(String).join(', ');
  return String(t).trim() || null;
}

function fulfillmentOrderId(data: any): string | null {
  const id =
    data.order_id ??
    data.order?.id ??
    data.fulfillment?.order_id ??
    (typeof data.order === 'string' ? data.order : null) ??
    data.id;
  return id != null ? String(id) : null;
}

function getLineItemProductName(lineItem: any) {
  const productName = String(lineItem.product_name ?? lineItem.name ?? lineItem.title ?? '').trim();
  const variantName = String(lineItem.variant_name ?? '').trim();
  if (productName && variantName) return `${productName} - ${variantName}`;
  return productName || variantName || '(未命名商品)';
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getLineItemNetTotal(lineItem: any, qty: number) {
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

function getLineItemUnitPrice(lineItem: any, qty: number) {
  const unitPrice = toFiniteNumber(lineItem.price ?? lineItem.unit_price, 0);
  if (qty <= 0) return unitPrice;
  return Math.round(getLineItemNetTotal(lineItem, qty) / qty);
}

function buildMemberRowFromEasyStoreCustomer(customer: any, userId: string) {
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
  const clientCat = tagsToClientCat(customer);
  if (clientCat) row.client_cat = clientCat;

  return row;
}

async function upsertMemberFromEasyStoreCustomer(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  customer: any
) {
  if (!customer?.id) return null;

  const { data, error } = await supabase
    .from('members')
    .upsert(buildMemberRowFromEasyStoreCustomer(customer, userId), { onConflict: 'easystore_customer_id,user_id' })
    .select('id')
    .maybeSingle();

  if (!error && data?.id) return data.id as string;

  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('user_id', userId)
    .eq('easystore_customer_id', String(customer.id))
    .maybeSingle();

  return (member?.id as string | undefined) ?? null;
}

async function buildEasyStoreProductIdMapWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  uid: string,
  easystoreProductIds: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(easystoreProductIds.map((s) => String(s).trim()).filter(Boolean))];
  const map: Record<string, string> = {};
  const CHUNK = 150;
  for (let j = 0; j < unique.length; j += CHUNK) {
    const chunk = unique.slice(j, j + CHUNK);
    const { data } = await supabase
      .from('products')
      .select('id, easystore_product_id')
      .eq('user_id', uid)
      .in('easystore_product_id', chunk);
    for (const row of data ?? []) {
      const id = row.easystore_product_id as string | null;
      if (id && row.id && map[id] == null) map[id] = row.id as string;
    }
  }
  return map;
}

async function buildSkuToProductIdMapWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  uid: string,
  skus: string[]
): Promise<Record<string, string>> {
  const unique = [...new Set(skus.map((s) => String(s).trim()).filter(Boolean))];
  const map: Record<string, string> = {};
  const CHUNK = 150;
  for (let j = 0; j < unique.length; j += CHUNK) {
    const chunk = unique.slice(j, j + CHUNK);
    const { data } = await supabase
      .from('products')
      .select('id, product_code')
      .eq('user_id', uid)
      .in('product_code', chunk);
    for (const row of data ?? []) {
      const code = row.product_code as string | null;
      if (code && row.id && map[code] == null) map[code] = row.id as string;
    }
  }
  return map;
}

function normalizeReserveMap(items: OrderLineItem[]) {
  const map = new Map<string, number>();
  for (const item of items) {
    if (!item.product_id) continue;
    const qty = Math.max(0, Number(item.qty || 0) - Math.max(0, Number(item.shipped_qty || 0)));
    if (qty <= 0) continue;
    map.set(item.product_id, (map.get(item.product_id) ?? 0) + qty);
  }
  return map;
}

async function adjustDeltaReserve(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  prevItems: OrderLineItem[],
  nextItems: OrderLineItem[],
  notePrefix: string
) {
  const prevMap = normalizeReserveMap(prevItems);
  const nextMap = normalizeReserveMap(nextItems);
  const keys = new Set<string>([...prevMap.keys(), ...nextMap.keys()]);

  for (const pid of keys) {
    const prev = prevMap.get(pid) ?? 0;
    const next = nextMap.get(pid) ?? 0;
    const delta = Math.floor(next - prev);
    if (delta === 0) continue;
    const type = delta > 0 ? 'reserve' : 'release';
    const qty = Math.abs(delta);
    const { error } = await supabase.rpc('adjust_inventory', {
      p_product_id: pid,
      p_user_id: userId,
      p_type: type,
      p_qty: qty,
      p_note: `${notePrefix}${type === 'reserve' ? '保留' : '釋放'}（${qty}）`,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EasyStore webhook] adjust_inventory reserve delta failed', {
        pid,
        type,
        qty,
        error: error.message,
      });
    }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.EASYSTORE_CLIENT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 });
  }

  const body = await req.text();
  const hmacHeader = req.headers.get('easystore-hmac-sha256') || '';

  const digestHex = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const digestB64 = crypto.createHmac('sha256', secret).update(body).digest('base64');

  const provided = hmacHeader.trim();
  const ok =
    (provided.length === digestHex.length &&
      timingSafeEqual(Buffer.from(digestHex, 'utf8'), Buffer.from(provided, 'utf8'))) ||
    (provided.length === digestB64.length &&
      timingSafeEqual(Buffer.from(digestB64, 'utf8'), Buffer.from(provided, 'utf8')));

  if (!ok) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  const topic = req.headers.get('x-easystore-topic') || '';
  const shop = req.headers.get('x-easystore-shop-domain') || '';

  let data: any = null;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: integration } = await supabase
    .from('easystore_integrations')
    .select('user_id')
    .eq('shop', shop)
    .maybeSingle();

  if (!integration?.user_id) {
    return NextResponse.json({ ok: true });
  }

  const userId = integration.user_id as string;
  const eventHeaderId =
    req.headers.get('x-easystore-event-id') ||
    req.headers.get('x-easystore-webhook-id') ||
    req.headers.get('x-request-id') ||
    '';
  const eventKey = eventHeaderId.trim()
    ? `${shop}:${topic}:${eventHeaderId.trim()}`
    : `${shop}:${topic}:${crypto.createHash('sha256').update(body).digest('hex')}`;
  const { data: eventRow, error: eventErr } = await supabase
    .from('easystore_webhook_events')
    .insert({
      user_id: userId,
      shop,
      topic,
      event_key: eventKey,
    })
    .select('id')
    .maybeSingle();
  if (eventErr) {
    if ((eventErr as { code?: string }).code === '23505') {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // eslint-disable-next-line no-console
    console.error('[EasyStore webhook] idempotency write failed', eventErr);
    return NextResponse.json({ error: 'Webhook idempotency write failed' }, { status: 500 });
  }
  if (!eventRow?.id) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  function mapOrderStatus(financialStatus: string | null | undefined, fulfillmentStatus: string | null | undefined) {
    const f = String(financialStatus ?? '').toLowerCase();
    const ff = String(fulfillmentStatus ?? '').toLowerCase();

    if (f.includes('cancel')) return 'cancelled';
    if (ff.includes('cancel')) return 'cancelled';

    if (ff.includes('partial')) return 'partial';
    if (ff.includes('ship') || ff.includes('fulfill') || ff === 'fulfilled') return 'shipped';

    if (f === 'unpaid' || f === 'pending' || f === 'authorized') return 'pending';

    return 'pending';
  }

  function isPaidEasyStoreOrder(order: any) {
    const status = String(order.financial_status ?? '').toLowerCase();
    return status === 'paid' || status === 'partially_refunded';
  }

  function getLineItemShippedQty(lineItem: any, qty: number, fulfillmentStatus: string | null | undefined) {
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

    return mapOrderStatus(null, fulfillmentStatus) === 'shipped' ? qty : 0;
  }

  if (topic === 'orders/create' || topic === 'orders/update') {
    if (!isPaidEasyStoreOrder(data)) {
      return NextResponse.json({ ok: true, skipped: 'unpaid_order' });
    }

    const orderTotal = Number(data.total_price ?? data.total_amount ?? 0) || 0;
    const subtotal = Number(data.subtotal_price ?? orderTotal) || orderTotal;
    const easystoreOrderId = String(data.id);

    let memberId: string | null = null;
    if (data.customer?.id) {
      memberId = await upsertMemberFromEasyStoreCustomer(supabase, userId, data.customer);
    }

    const { data: prevOrder } = await supabase
      .from('customer_orders')
      .select('id, status')
      .eq('user_id', userId)
      .eq('easystore_order_id', easystoreOrderId)
      .maybeSingle();
    let prevItems: OrderLineItem[] = [];
    if (prevOrder?.id) {
      const { data: oldRows } = await supabase
        .from('customer_order_items')
        .select('product_id, qty, shipped_qty')
        .eq('order_id', prevOrder.id);
      prevItems = (oldRows ?? []).map((r) => ({
        product_id: (r as { product_id?: string | null }).product_id ?? null,
        qty: Number((r as { qty?: number }).qty ?? 0),
        shipped_qty: Number((r as { shipped_qty?: number }).shipped_qty ?? 0),
      }));
    }

    const nextStatus = mapOrderStatus(data.financial_status, data.fulfillment_status);
    const { data: upserted, error: orderUpsertErr } = await supabase
      .from('customer_orders')
      .upsert(
        {
          user_id: userId,
          easystore_order_id: easystoreOrderId,
          order_code: String(data.number ?? data.id),
          advance_date: data.created_at ?? null,
          member_id: memberId,
          currency: data.currency ?? data.currency_code ?? '台幣',
          tax_type: '稅內含',
          taxrate: 0.05,
          subtotal,
          tax_amount: +Number(orderTotal - subtotal).toFixed(2),
          total: orderTotal,
          sales_channel: 'EasyStore',
          note: data.note ?? null,
          status: nextStatus,
        },
        { onConflict: 'user_id,easystore_order_id' }
      )
      .select('id')
      .maybeSingle();

    if (orderUpsertErr) {
      // eslint-disable-next-line no-console
      console.error('[EasyStore webhook] customer_orders upsert', orderUpsertErr);
    }

    let orderUuid = upserted?.id as string | undefined;
    if (!orderUuid) {
      const { data: found } = await supabase
        .from('customer_orders')
        .select('id')
        .eq('user_id', userId)
        .eq('easystore_order_id', easystoreOrderId)
        .maybeSingle();
      orderUuid = found?.id;
    }

    // ES-003：同步明細並依 SKU 對應 product_id
    const lineItems: any[] = data.line_items ?? [];
    if (orderUuid) {
      const skus = lineItems.map((li: any) => li.sku).filter(Boolean).map((s: any) => String(s).trim());
      const easystoreProductIds = lineItems
        .map((li: any) => li.product_id)
        .filter(Boolean)
        .map((id: any) => String(id).trim());
      const easystoreProductIdMap = await buildEasyStoreProductIdMapWebhook(supabase, userId, easystoreProductIds);
      const skuMap = await buildSkuToProductIdMapWebhook(supabase, userId, skus);

      await supabase.from('customer_order_items').delete().eq('order_id', orderUuid);

      const rows = lineItems.map((li: any) => {
        const qty = Number(li.quantity ?? li.qty ?? 0);
        const unitPrice = getLineItemUnitPrice(li, qty);
        const sku = li.sku != null ? String(li.sku).trim() : '';
        const easystoreProductId = li.product_id != null ? String(li.product_id).trim() : '';
        const productId =
          (easystoreProductId && easystoreProductIdMap[easystoreProductId]) ||
          (sku && skuMap[sku]) ||
          null;
        return {
          order_id: orderUuid,
          easystore_line_item_id: li.id != null ? String(li.id) : null,
          product_id: productId,
          product_code: li.sku ?? null,
          product_name: getLineItemProductName(li),
          unit_name: li.unit ?? null,
          qty,
          shipped_qty: getLineItemShippedQty(li, qty, data.fulfillment_status),
          unit_price: unitPrice,
          discount_pct: 100,
          subtotal: Math.round(getLineItemNetTotal(li, qty)),
          note: li.note ?? null,
        };
      });

      const { error: itemsErr } = rows.length
        ? await supabase.from('customer_order_items').insert(rows)
        : { error: null };
      if (itemsErr) {
        // eslint-disable-next-line no-console
        console.error('[EasyStore webhook] customer_order_items insert', itemsErr);
      } else {
        const nextItemsRaw: OrderLineItem[] = rows.map((r) => ({
          product_id: (r.product_id as string | null) ?? null,
          qty: Number(r.qty ?? 0),
          shipped_qty: Number(r.shipped_qty ?? 0),
        }));
        const prevStatus = String((prevOrder as { status?: string } | null)?.status ?? '').toLowerCase();
        const prevReserveItems = prevStatus === 'cancelled' || prevStatus === 'shipped' ? [] : prevItems;
        const nextReserveItems = nextStatus === 'cancelled' || nextStatus === 'shipped' ? [] : nextItemsRaw;
        await adjustDeltaReserve(
          supabase,
          userId,
          prevReserveItems,
          nextReserveItems,
          `EasyStore 訂單 ${String(data.number ?? data.id)} `
        );
      }
    }
  }

  if (topic === 'orders/cancel') {
    const orderId = String(data.id);
    const { data: existing } = await supabase
      .from('customer_orders')
      .select('id, order_code')
      .eq('user_id', userId)
      .eq('easystore_order_id', orderId)
      .maybeSingle();
    if (existing?.id) {
      const { data: items } = await supabase
        .from('customer_order_items')
        .select('product_id, qty, shipped_qty')
        .eq('order_id', existing.id);
      await adjustDeltaReserve(
        supabase,
        userId,
        (items ?? []).map((r) => ({
          product_id: (r as { product_id?: string | null }).product_id ?? null,
          qty: Number((r as { qty?: number }).qty ?? 0),
          shipped_qty: Number((r as { shipped_qty?: number }).shipped_qty ?? 0),
        })),
        [],
        `EasyStore 訂單取消 ${String((existing as { order_code?: string }).order_code ?? orderId)} `
      );
    }
    await supabase
      .from('customer_orders')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('easystore_order_id', orderId);
  }

  if (topic === 'orders/fulfillment_create') {
    const oid = fulfillmentOrderId(data);
    if (oid) {
      const { data: existing } = await supabase
        .from('customer_orders')
        .select('id, order_code')
        .eq('user_id', userId)
        .eq('easystore_order_id', oid)
        .maybeSingle();
      if (existing?.id) {
        const { data: items } = await supabase
          .from('customer_order_items')
          .select('id, product_id, qty, shipped_qty')
          .eq('order_id', existing.id);
        for (const item of items ?? []) {
          const productId = (item as { product_id?: string | null }).product_id;
          if (!productId) continue;
          const qty = Number((item as { qty?: number }).qty ?? 0);
          const shipped = Number((item as { shipped_qty?: number }).shipped_qty ?? 0);
          const delta = Math.max(0, Math.floor(qty - shipped));
          if (delta <= 0) continue;
          const { error: rpcErr } = await supabase.rpc('adjust_inventory', {
            p_product_id: productId,
            p_user_id: userId,
            p_type: 'ship',
            p_qty: delta,
            p_note: `EasyStore 出貨 ${String((existing as { order_code?: string }).order_code ?? oid)}`,
          });
          if (rpcErr) {
            // eslint-disable-next-line no-console
            console.error('[EasyStore webhook] ship adjust failed', rpcErr);
            continue;
          }
          await supabase
            .from('customer_order_items')
            .update({ shipped_qty: qty })
            .eq('id', (item as { id: string }).id);
        }
      }
      await supabase
        .from('customer_orders')
        .update({ status: 'shipped' })
        .eq('user_id', userId)
        .eq('easystore_order_id', oid);
    }
  }

  if (topic === 'products/create' || topic === 'products/update') {
    const raw = data.product ?? data;
    if (raw?.id) {
      const row = toProductRow(raw, userId);
      const { data: upserted, error: upsertErr } = await supabase
        .from('products')
        .upsert(row, { onConflict: 'user_id,easystore_product_id' })
        .select('id, available_stock, channel_stock_easystore, name, easystore_product_id')
        .maybeSingle();
      if (upsertErr) {
        // eslint-disable-next-line no-console
        console.error('[EasyStore webhook] products upsert', upsertErr);
      } else if (upserted) {
        const available = Number((upserted as { available_stock?: number }).available_stock ?? 0);
        const channel = Number((upserted as { channel_stock_easystore?: number }).channel_stock_easystore ?? 0);
        if (channel > available) {
          // eslint-disable-next-line no-console
          console.warn('[EasyStore webhook] Oversell Risk', {
            user_id: userId,
            product_id: (upserted as { id?: string }).id,
            easystore_product_id: (upserted as { easystore_product_id?: string }).easystore_product_id,
            product_name: (upserted as { name?: string }).name,
            available_stock: available,
            channel_stock_easystore: channel,
          });
        }
      }
    }
  }

  if (topic === 'customers/create') {
    await supabase.from('members').upsert(
      {
        user_id: userId,
        easystore_customer_id: String(data.id),
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        email: data.email,
        phone: data.phone || null,
      },
      { onConflict: 'easystore_customer_id,user_id' }
    );
  }

  if (topic === 'customers/update') {
    const cat = tagsToClientCat(data);
    const row: Record<string, unknown> = {
      user_id: userId,
      easystore_customer_id: String(data.id),
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
      email: data.email,
      phone: data.phone || null,
    };
    if (cat != null) row.client_cat = cat;
    await supabase.from('members').upsert(row, { onConflict: 'easystore_customer_id,user_id' });
  }

  return NextResponse.json({ ok: true });
}
