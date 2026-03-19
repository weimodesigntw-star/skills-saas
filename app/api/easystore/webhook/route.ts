import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function timingSafeEqual(a: Buffer, b: Buffer) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.EASYSTORE_CLIENT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 });
  }

  const body = await req.text();
  const hmacHeader = req.headers.get('easystore-hmac-sha256') || '';

  // 驗證 webhook 來源（接受 hex 或 base64 兩種常見格式）
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

  // 查這個 shop 對應的 user_id
  const { data: integration } = await supabase
    .from('easystore_integrations')
    .select('user_id')
    .eq('shop', shop)
    .maybeSingle();

  if (!integration?.user_id) {
    return NextResponse.json({ ok: true }); // 忽略未知 shop
  }

  const userId = integration.user_id as string;

  function mapOrderStatus(financialStatus: string | null | undefined, fulfillmentStatus: string | null | undefined) {
    const f = String(financialStatus ?? '').toLowerCase();
    const ff = String(fulfillmentStatus ?? '').toLowerCase();

    if (f.includes('cancel')) return 'cancelled';
    if (ff.includes('cancel')) return 'cancelled';

    // 優先以 fulfillment 判斷出貨狀態
    if (ff.includes('partial')) return 'partial';
    if (ff.includes('ship') || ff.includes('fulfill') || ff === 'fulfilled') return 'shipped';

    // fallback：以 financial status 推測
    if (f === 'paid') return 'shipped';
    if (f === 'unpaid' || f === 'pending' || f === 'authorized') return 'pending';

    return 'pending';
  }

  if (topic === 'orders/create' || topic === 'orders/update') {
    const orderTotal = Number(data.total_price ?? data.total_amount ?? 0) || 0;
    const subtotal = Number(data.subtotal_price ?? orderTotal) || orderTotal;

    // 查 member_id
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

    await supabase
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
      );
  }

  if (topic === 'orders/cancel') {
    await supabase
      .from('customer_orders')
      .update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('easystore_order_id', String(data.id));
  }

  if (topic === 'customers/create' || topic === 'customers/update') {
    await supabase
      .from('members')
      .upsert(
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

  return NextResponse.json({ ok: true });
}

