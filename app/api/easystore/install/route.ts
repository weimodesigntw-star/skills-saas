import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

function timingSafeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get('shop');
  const hmac = searchParams.get('hmac');
  const timestamp = searchParams.get('timestamp');
  const state = searchParams.get('state');

  if (!shop || !hmac || !timestamp) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const secret = process.env.EASYSTORE_CLIENT_SECRET;
  const clientId = process.env.EASYSTORE_CLIENT_ID;
  const appUrl = process.env.EASYSTORE_APP_URL;

  if (!secret || !clientId || !appUrl) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 });
  }

  // 驗證 HMAC（依規格：shop + timestamp）
  const params = `shop=${shop}&timestamp=${timestamp}`;
  const digest = crypto.createHmac('sha256', secret).update(params).digest('hex');

  if (!timingSafeEqualHex(digest, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  const redirectUri = encodeURIComponent(`${appUrl}/api/easystore/callback`);
  const scopes = 'read_orders,read_customers,read_products,write_products';
  const statePart = state ? `&state=${encodeURIComponent(state)}` : '';
  const authUrl = `https://${shop}/oauth/authorize?app_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}${statePart}`;

  return NextResponse.redirect(authUrl);
}

