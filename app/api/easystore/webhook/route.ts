import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type EasyStoreProduct = Record<string, any>;

/** 與 sync-products 一致：不寫入 product_code / barcode，避免 unique 衝突 */
function toProductRow(p: EasyStoreProduct, userId: string) {
  const variants: any[] = p.variants ?? [];
  const firstVariant = variants[0] ?? {};
  const stock = Number(
    p.inventory_quantity ?? firstVariant.inventory_quantity ?? firstVariant.inventory ?? p.inventory ?? 0
  );
  const price = Number(p.price ?? firstVariant.price ?? 0);
  const statusRaw = String(p.status ?? p.state ?? 'active').toLowerCase();
  const isActive = !['archived', 'disabled', 'inactive', 'draft'].includes(statusRaw);

  const imageUrl: string | null =
    p.images?.[0]?.src ?? p.image?.src ?? p.featured_image ?? null;

  return {
    user_id: userId,
    easystore_product_id: String(p.id),
    name: p.name ?? p.title ?? '(未命名商品)',
    image_url: imageUrl,
    price,
    stock,
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

  function mapOrderStatus(financialStatus: string | null | undefined, fulfillmentStatus: string | null | undefined) {
    const f = String(financialStatus ?? '').toLowerCase();
    const ff = String(fulfillmentStatus ?? '').toLowerCase();

    if (f.includes('cancel')) return 'cancelled';
    if (ff.includes('cancel')) return 'cancelled';

    if (ff.includes('partial')) return 'partial';
    if (ff.includes('ship') || ff.includes('fulfill') || ff === 'fulfilled') return 'shipped';

    if (f === 'paid') return 'shipped';
    if (f === 'unpaid' || f === 'pending' || f === 'authorized') return 'pending';

    return 'pending';
  }

  if (topic === 'orders/create' || topic === 'orders/update') {
    const orderTotal = Number(data.total_price ?? data.total_amount ?? 0) || 0;
    const subtotal = Number(data.subtotal_price ?? orderTotal) || orderTotal;

    let memberId: string | null = null;
    if (data.customer?.id) {
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', userId)
        .eq('easystore_customer_id', String(data.customer.id))
        .maybeSingle();
      memberId = member?.id ?? null;
    }

    const { data: upserted, error: orderUpsertErr } = await supabase
      .from('customer_orders')
      .upsert(
        {
          user_id: userId,
          easystore_order_id: String(data.id),
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
          status: mapOrderStatus(data.financial_status, data.fulfillment_status),
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
        .eq('easystore_order_id', String(data.id))
        .maybeSingle();
      orderUuid = found?.id;
    }

    // ES-003：同步明細並依 SKU 對應 product_id
    const lineItems: any[] = data.line_items ?? [];
    if (orderUuid && lineItems.length > 0) {
      const skus = lineItems.map((li: any) => li.sku).filter(Boolean).map((s: any) => String(s).trim());
      const skuMap = await buildSkuToProductIdMapWebhook(supabase, userId, skus);

      await supabase.from('customer_order_items').delete().eq('order_id', orderUuid);

      const rows = lineItems.map((li: any) => {
        const qty = Number(li.quantity ?? li.qty ?? 0);
        const unitPrice = Number(li.price ?? li.unit_price ?? 0);
        const sku = li.sku != null ? String(li.sku).trim() : '';
        const productId = sku && skuMap[sku] ? skuMap[sku] : null;
        return {
          order_id: orderUuid,
          easystore_line_item_id: li.id != null ? String(li.id) : null,
          product_id: productId,
          product_code: li.sku ?? null,
          product_name: li.name ?? '(未命名商品)',
          unit_name: li.unit ?? null,
          qty,
          shipped_qty: 0,
          unit_price: unitPrice,
          discount_pct: 100,
          subtotal: qty * unitPrice,
          note: li.note ?? null,
        };
      });

      const { error: itemsErr } = await supabase.from('customer_order_items').insert(rows);
      if (itemsErr) {
        // eslint-disable-next-line no-console
        console.error('[EasyStore webhook] customer_order_items insert', itemsErr);
      }
    }
  }

  if (topic === 'orders/cancel') {
    await supabase
      .from('customer_orders')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('easystore_order_id', String(data.id));
  }

  if (topic === 'orders/fulfillment_create') {
    const oid = fulfillmentOrderId(data);
    if (oid) {
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
      await supabase.from('products').upsert(row, { onConflict: 'user_id,easystore_product_id' });
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
