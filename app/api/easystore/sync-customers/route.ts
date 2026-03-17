import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type EasyStoreCustomer = Record<string, any>;

export async function POST() {
  const supabase = createServerClient();

  // 取得當前登入 user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 取得 EasyStore integration（用 admin client 避免 RLS / NULL user_id 問題）
  const admin = createAdminClient();
  const { data: integration, error: integErr } = await admin
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', user.id)
    .maybeSingle();

  if (integErr) {
    return NextResponse.json({ error: integErr.message }, { status: 500 });
  }

  if (!integration?.access_token) {
    return NextResponse.json({ error: '尚未連結 EasyStore' }, { status: 400 });
  }

  const { shop, access_token } = integration as { shop: string; access_token: string };

  // 拉所有 customers（含分頁）
  let allCustomers: EasyStoreCustomer[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const res = await fetch(`https://${shop}/api/v2/customers?limit=${limit}&page=${page}`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `EasyStore API 錯誤: ${res.status}`, detail: errText },
        { status: 502 }
      );
    }

    const json = (await res.json().catch(() => ({}))) as any;
    // debug: 印出 EasyStore response 結構（避免過大，截斷）
    // eslint-disable-next-line no-console
    console.log(
      '[EasyStore] customers page',
      page,
      'raw keys:',
      Object.keys(json),
      'json(head):',
      JSON.stringify(json).substring(0, 500)
    );
    const customers: EasyStoreCustomer[] = json.customers ?? json.data ?? [];
    if (customers.length === 0) break;

    allCustomers = allCustomers.concat(customers);

    const total = json.pagination?.total ?? json.total ?? null;
    if (total !== null && allCustomers.length >= total) break;
    if (customers.length < limit) break;
    page++;
  }

  // 轉換成 members 記錄
  const records = allCustomers.map((c) => {
    const fallbackName = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    const record: Record<string, any> = {
      user_id: user.id,
      easystore_customer_id: String(c.id),
      name: (c.name ?? c.full_name ?? fallbackName) || '(未命名)',
      email: c.email ?? null,
      phone: c.phone ?? c.mobile ?? null,
    };

    if (c.birthday) record.birthday = c.birthday;
    if (c.state !== undefined) record.is_active = c.state === 'enabled';
    if (c.tags) record.client_cat = Array.isArray(c.tags) ? c.tags.join(', ') : c.tags;

    return record;
  });

  // 批次 upsert 進 members（多租戶：以 easystore_customer_id + user_id 去重）
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  const BATCH = 200;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await admin
      .from('members')
      .upsert(batch, { onConflict: 'easystore_customer_id,user_id' });

    if (error) {
      failed += batch.length;
      if (errors.length < 10) errors.push(`batch ${i}-${i + batch.length}: ${error.message}`);
    } else {
      synced += batch.length;
    }
  }

  return NextResponse.json({
    total: allCustomers.length,
    synced,
    failed,
    errors,
  });
}

