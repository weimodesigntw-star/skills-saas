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

  if (topic === 'orders/create') {
    await supabase
      .from('orders')
      .upsert(
        {
          user_id: userId,
          easystore_order_id: String(data.id),
          order_number: data.order_number,
          status: data.financial_status,
          total_amount: parseFloat(data.total_price),
          note: data.note || null,
          created_at: data.created_at,
        },
        { onConflict: 'easystore_order_id' }
      );
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

