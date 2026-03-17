import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

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
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');
  const timestamp = searchParams.get('timestamp');

  if (!shop || !code || !hmac || !timestamp) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const secret = process.env.EASYSTORE_CLIENT_SECRET;
  const clientId = process.env.EASYSTORE_CLIENT_ID;
  const appUrl = process.env.EASYSTORE_APP_URL;

  if (!secret || !clientId || !appUrl) {
    return NextResponse.json({ error: 'Missing env' }, { status: 500 });
  }

  // 驗證 HMAC：將所有參數（排除 hmac）按字母排序後串接
  const paramObj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== 'hmac') {
      paramObj[key] = value;
    }
  });
  const paramStr = Object.keys(paramObj)
    .sort()
    .map((k) => `${k}=${paramObj[k]}`)
    .join('&');

  const digest = crypto.createHmac('sha256', secret).update(paramStr).digest('hex');

  if (!timingSafeEqualHex(digest, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 });
  }

  // 換取 access_token
  const tokenRes = await fetch(`https://${shop}/api/3.0/oauth/access_token.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: secret,
      code,
    }),
  });

  const tokenJson = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  const accessToken = tokenJson.access_token;

  if (!accessToken) {
    return NextResponse.json({ error: 'Failed to get token' }, { status: 500 });
  }

  // 儲存到 Supabase（easystore_integrations table）
  const supabase = createAdminClient();
  await supabase
    .from('easystore_integrations')
    .upsert(
      {
        shop,
        access_token: accessToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop' }
    );

  // 跳回 Skills SaaS dashboard
  return NextResponse.redirect(`${appUrl}/dashboard?easystore=connected`);
}

