import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';

/** ES-005：用 access_token 呼叫 EasyStore 驗證連線（store.json 為主，部分商店仍為 shop.json） */
export async function GET() {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: integration, error: integErr } = await admin
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', ownerId)
    .maybeSingle();

  if (integErr) {
    return NextResponse.json({ ok: false, error: integErr.message }, { status: 500 });
  }
  if (!integration?.access_token) {
    return NextResponse.json({ ok: false, error: '尚未連結 EasyStore' });
  }

  const { shop, access_token } = integration as { shop: string; access_token: string };
  const headers = { 'Easystore-Access-Token': access_token };

  const candidates = [
    { url: `https://${shop}/api/3.0/store.json`, payloadKey: 'store' as const },
    { url: `https://${shop}/api/3.0/shop.json`, payloadKey: 'shop' as const },
  ];

  let lastStatus = 0;
  let lastText = '';

  for (const { url, payloadKey } of candidates) {
    const res = await fetch(url, { headers });
    lastStatus = res.status;
    lastText = (await res.text().catch(() => '')).slice(0, 300);

    if (res.ok) {
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(lastText) as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const shopPayload = (json[payloadKey] ?? json) as Record<string, unknown>;
      return NextResponse.json({ ok: true, shop: shopPayload });
    }
  }

  return NextResponse.json({
    ok: false,
    error: `EasyStore API ${lastStatus}: ${lastText || '無法取得商店資訊'}`,
  });
}
