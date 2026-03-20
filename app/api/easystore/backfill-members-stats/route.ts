import { NextResponse } from 'next/server';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  const { data: members, error: memberErr } = await admin
    .from('members')
    .select('id')
    .eq('user_id', user.id);

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
    .eq('user_id', user.id)
    .in('member_id', memberIds);

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
  for (const id of memberIds) {
    const s = stats[id] ?? { total: 0, count: 0 };
    const payload = {
      total_spent: Number(s.total.toFixed(2)),
      order_count: s.count,
      visit_count: s.count,
    };

    let { error } = await admin
      .from('members')
      .update(payload)
      .eq('user_id', user.id)
      .eq('id', id);

    // Fallback 1: no order_count
    if (error && isMissingColumn(error)) {
      ({ error } = await admin
        .from('members')
        .update({
          total_spent: Number(s.total.toFixed(2)),
          visit_count: s.count,
        })
        .eq('user_id', user.id)
        .eq('id', id));
    }

    // Fallback 2: no visit_count/order_count
    if (error && isMissingColumn(error)) {
      ({ error } = await admin
        .from('members')
        .update({
          total_spent: Number(s.total.toFixed(2)),
        })
        .eq('user_id', user.id)
        .eq('id', id));
    }

    // Fallback 3: still failing due to missing columns -> skip this member.
    if (!error) updated += 1;
  }

  return NextResponse.json({ updated });
}
