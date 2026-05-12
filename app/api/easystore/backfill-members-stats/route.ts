import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

export const runtime = 'nodejs';

function isMissingColumn(error: unknown) {
  const message = String((error as { message?: string })?.message ?? '').toLowerCase();
  const code = String((error as { code?: string })?.code ?? '');
  return (
    message.includes('column') ||
    message.includes('bad request') ||
    code === '42703' ||
    code === 'PGRST204'
  );
}

export async function POST() {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);

  if (!ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: members, error: memberErr } = await admin
    .from('members')
    .select('id')
    .eq('user_id', ownerId);

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 500 });
  }

  const memberIds = (members ?? []).map((m) => m.id);
  if (memberIds.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const { data: orders, error: orderErr } = await admin
    .from('customer_orders')
    .select('member_id,total')
    .eq('user_id', ownerId)
    .not('member_id', 'is', null);

  if (orderErr) {
    return NextResponse.json({ error: orderErr.message }, { status: 500 });
  }

  const stats: Record<string, { total: number; count: number }> = {};
  for (const id of memberIds) stats[id] = { total: 0, count: 0 };

  for (const row of orders ?? []) {
    const memberId = row.member_id as string | null;
    if (!memberId || !stats[memberId]) continue;
    stats[memberId].total += Number(row.total ?? 0);
    stats[memberId].count += 1;
  }

  let updated = 0;
  const CHUNK = 300;
  for (let i = 0; i < memberIds.length; i += CHUNK) {
    const ids = memberIds.slice(i, i + CHUNK);
    const rows = ids.map((id) => {
      const s = stats[id] ?? { total: 0, count: 0 };
      return {
        id,
        user_id: ownerId,
        total_spent: Number(s.total.toFixed(2)),
        order_count: s.count,
        visit_count: s.count,
      };
    });

    let { error } = await admin.from('members').upsert(rows, { onConflict: 'id' });

    // Fallback 1: no order_count
    if (error && isMissingColumn(error)) {
      const rowsNoOrderCount = rows.map(({ order_count: _oc, ...rest }) => rest);
      ({ error } = await admin.from('members').upsert(rowsNoOrderCount, { onConflict: 'id' }));
    }

    // Fallback 2: no visit_count/order_count
    if (error && isMissingColumn(error)) {
      const rowsTotalOnly = rows.map(({ order_count: _oc, visit_count: _vc, ...rest }) => rest);
      ({ error } = await admin.from('members').upsert(rowsTotalOnly, { onConflict: 'id' }));
    }

    // Fallback 3: still failing -> skip this chunk and continue.
    if (!error) updated += ids.length;
  }

  return NextResponse.json({ updated });
}
