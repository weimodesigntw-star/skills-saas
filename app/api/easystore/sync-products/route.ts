import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type EasyStoreProduct = Record<string, any>;

export async function POST(req: NextRequest) {
  let mode: 'incremental' | 'full' = 'incremental';
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.mode === 'full') mode = 'full';
  } catch {
    // ignore
  }

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: integration, error: integErr } = await admin
    .from('easystore_integrations')
    .select('shop, access_token')
    .eq('user_id', user.id)
    .maybeSingle();

  if (integErr) return NextResponse.json({ error: integErr.message }, { status: 500 });
  if (!integration?.access_token) {
    return NextResponse.json({ error: '尚未連結 EasyStore' }, { status: 400 });
  }

  const { shop, access_token } = integration as { shop: string; access_token: string };

  let sinceDate: string | null = null;
  if (mode === 'incremental') {
    const { data: syncState } = await admin
      .from('easystore_sync_state')
      .select('last_synced_at')
      .eq('user_id', user.id)
      .eq('resource', 'products')
      .maybeSingle();
    sinceDate = (syncState?.last_synced_at as string | null) ?? null;
  }
  const syncStartedAt = new Date().toISOString();

  let allProducts: EasyStoreProduct[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    let url = `https://${shop}/api/3.0/products.json?page=${page}&limit=${limit}`;
    if (sinceDate) url += `&updated_at_min=${encodeURIComponent(sinceDate)}`;

    const res = await fetch(url, {
      headers: { 'Easystore-Access-Token': access_token },
    });

    if (!res.ok) {
      const bodyHead = (await res.text().catch(() => '')).slice(0, 300);
      return NextResponse.json(
        { error: 'EasyStore products API 呼叫失敗', status: res.status, bodyHead, url },
        { status: 502 }
      );
    }

    const json: any = await res.json();
    const products: EasyStoreProduct[] = json.products ?? [];
    if (products.length === 0) break;

    allProducts = allProducts.concat(products);

    const totalCount = json.total_count ?? json.total ?? null;
    const pageCount = json.page_count ?? null;
    if (totalCount !== null && allProducts.length >= totalCount) break;
    if (pageCount !== null && page >= pageCount) break;
    if (products.length < limit) break;
    page++;
  }

  const rows = allProducts.map((p) => {
    const variants: any[] = p.variants ?? [];
    const firstVariant = variants[0] ?? {};
    const stock = Number(
      p.inventory_quantity ?? firstVariant.inventory_quantity ?? firstVariant.inventory ?? p.inventory ?? 0
    );
    const price = Number(p.price ?? firstVariant.price ?? 0);
    const sku = p.sku ?? firstVariant.sku ?? null;
    const barcode = p.barcode ?? firstVariant.barcode ?? null;
    const statusRaw = String(p.status ?? p.state ?? 'active').toLowerCase();
    const isActive = !['archived', 'disabled', 'inactive', 'draft'].includes(statusRaw);

    return {
      user_id: user.id,
      easystore_product_id: String(p.id),
      name: p.name ?? p.title ?? '(未命名商品)',
      product_code: sku,
      barcode,
      price,
      stock,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
  });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await admin.from('products').upsert(batch, { onConflict: 'user_id,easystore_product_id' });
    if (error) {
      failed += batch.length;
      if (errors.length < 10) errors.push(`batch ${i}-${i + batch.length}: ${error.message}`);
    } else {
      synced += batch.length;
    }
  }

  await admin.from('easystore_sync_state').upsert(
    {
      user_id: user.id,
      resource: 'products',
      last_synced_at: syncStartedAt,
      synced_count: synced,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,resource' }
  );

  return NextResponse.json({
    mode,
    since: sinceDate,
    total: allProducts.length,
    synced,
    failed,
    errors,
  });
}
