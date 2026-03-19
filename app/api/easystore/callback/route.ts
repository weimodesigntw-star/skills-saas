import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient, createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

function timingSafeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function tryRegisterWebhook(params: {
  shop: string;
  accessToken: string;
  topic: string;
  address: string;
}) {
  const { shop, accessToken, topic, address } = params;

  const candidates: Array<{ url: string; body: any }> = [
    {
      url: `https://${shop}/api/3.0/webhooks.json`,
      body: { webhook: { topic, address, format: 'json' } },
    },
    {
      url: `https://${shop}/api/3.0/webhooks.json`,
      body: { webhook: { event: topic, callback_url: address, format: 'json' } },
    },
    {
      url: `https://${shop}/api/3.0/webhooks.json`,
      body: { topic, address },
    },
    {
      url: `https://${shop}/api/3.0/webhooks.json`,
      body: { event: topic, callback_url: address },
    },
    {
      url: `https://${shop}/api/3.0/webhooks`,
      body: { webhook: { topic, address, format: 'json' } },
    },
  ];

  for (const c of candidates) {
    try {
      const res = await fetch(c.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Easystore-Access-Token': accessToken,
        },
        body: JSON.stringify(c.body),
      });
      if (res.ok) {
        // eslint-disable-next-line no-console
        console.log('[EasyStore] webhook registered', { topic, url: c.url });
        return { ok: true as const };
      }
      const head = (await res.text().catch(() => '')).slice(0, 300);
      // eslint-disable-next-line no-console
      console.warn('[EasyStore] webhook register failed', { topic, url: c.url, status: res.status, head });
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.warn('[EasyStore] webhook register exception', { topic, url: c.url, message: e?.message ?? String(e) });
    }
  }

  return { ok: false as const };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get('shop');
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');
  const timestamp = searchParams.get('timestamp');
  const state = searchParams.get('state');

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

  // 優先使用當前登入 session 的 user_id（避免 state 遺失）
  let userIdFromSession: string | null = null;
  try {
    const supabaseSession = createServerClient();
    const { data: { user } } = await supabaseSession.auth.getUser();
    userIdFromSession = user?.id ?? null;
  } catch {
    // ignore
  }

  // 儲存到 Supabase（easystore_integrations table）
  const supabase = createAdminClient();
  const webhookAddress = `${appUrl}/api/easystore/webhook`;
  await supabase
    .from('easystore_integrations')
    .upsert(
      {
        shop,
        access_token: accessToken,
        user_id: userIdFromSession || state || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop' }
    );

  // OAuth 成功後自動註冊 webhooks（失敗不阻擋導頁，只記錄 log）
  const topics = [
    'orders/create',
    'orders/update',
    'orders/cancel',
    'customers/create',
    'customers/update',
  ];
  await Promise.all(
    topics.map((t) => tryRegisterWebhook({ shop, accessToken, topic: t, address: webhookAddress }))
  );

  // 跳回 Skills SaaS dashboard
  return NextResponse.redirect(`${appUrl}/dashboard?easystore=connected`);
}

