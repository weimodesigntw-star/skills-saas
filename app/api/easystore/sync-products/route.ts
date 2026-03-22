import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type EasyStoreProduct = Record<string, any>;

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
  let syncStateReadError: string | null = null;
  if (mode === 'incremental') {
    const { data: syncState, error: syncStateErr } = await admin
      .from('easystore_sync_state')
      .select('last_synced_at')
      .eq('user_id', user.id)
      .eq('resource', 'products')
      .maybeSingle();
    if (syncStateErr) {
      syncStateReadError = syncStateErr.message;
      console.error('[sync-products] easystore_sync_state read failed:', syncStateErr);
    }
    sinceDate = (syncState?.last_synced_at as string | null) ?? null;
  }
  const syncStartedAt = new Date().toISOString();
  const startMs = Date.now();
  const TIME_LIMIT_MS = 8500;

  let page = 1;
  const limit = 50;
  let totalFetched = 0;
  let synced = 0;
  let failed = 0;
  let partial = false;
  const errors: string[] = [];

  while (true) {
    if (Date.now() - startMs > TIME_LIMIT_MS) {
      partial = true;
      break;
    }

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
    totalFetched += products.length;

    const rows = products.map((p) => toProductRow(p, user.id));
    const { error: upsertErr } = await admin
      .from('products')
      .upsert(rows, { onConflict: 'user_id,easystore_product_id' });
    if (upsertErr) {
      failed += products.length;
      if (errors.length < 10) errors.push(`page ${page}: ${upsertErr.message}`);
    } else {
      synced += products.length;
    }

    const totalCount = json.total_count ?? json.total ?? null;
    const pageCount = json.page_count ?? null;
    if (totalCount !== null && totalFetched >= totalCount) break;
    if (pageCount !== null && page >= pageCount) break;
    if (products.length < limit) break;
    page++;
  }

  let syncStateWriteError: string | null = null;
  if (!partial || synced > 0) {
    const { error: upsertStateErr } = await admin.from('easystore_sync_state').upsert(
      {
        user_id: user.id,
        resource: 'products',
        last_synced_at: syncStartedAt,
        synced_count: synced,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,resource' }
    );
    if (upsertStateErr) {
      syncStateWriteError = upsertStateErr.message;
      console.error('[sync-products] easystore_sync_state upsert failed:', upsertStateErr);
    }
  }

  return NextResponse.json({
    mode,
    since: sinceDate,
    total: totalFetched,
    synced,
    failed,
    partial,
    errors,
    /** 若表未建立（migration 044），會有訊息，請在 Supabase 執行 044_easystore_sync_state.sql */
    syncStateReadError,
    syncStateWriteError,
  });
}
