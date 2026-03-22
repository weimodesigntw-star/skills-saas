import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/** ES-005：用 access_token 呼叫 shop.json 驗證連線 */
export async function GET() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: integration, error: integErr } = await admin
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', user.id)
    .maybeSingle();

  if (integErr) {
    return NextResponse.json({ ok: false, error: integErr.message }, { status: 500 });
  }
  if (!integration?.access_token) {
    return NextResponse.json({ ok: false, error: '尚未連結 EasyStore' });
  }

  const { shop, access_token } = integration as { shop: string; access_token: string };
  const res = await fetch(`https://${shop}/api/3.0/shop.json`, {
    headers: { 'Easystore-Access-Token': access_token },
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 300);
    return NextResponse.json({
      ok: false,
      error: `EasyStore API ${res.status}: ${text || res.statusText}`,
    });
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const shopPayload = (json.shop ?? json) as Record<string, unknown>;
  return NextResponse.json({ ok: true, shop: shopPayload });
}
