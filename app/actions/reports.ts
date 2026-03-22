'use server';

import { createServerClient } from '@/lib/supabase/server';

export type ReportSource = 'POS' | 'EasyStore';

export type ShipmentReportRow = {
  id: string;
  source: ReportSource;
  product_name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  shipments: {
    ship_code: string;
    ship_date: string | null;
    currency: string | null;
    tax_type: string | null;
    taxrate: number | null;
    member_id: string | null;
    status: string | null;
    members: { name: string | null; client_code: string | null } | null;
  } | null;
};

export type ProfitReportRow = {
  id: string;
  source: ReportSource;
  product_name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
  products: { purchase_price: number | null } | null;
  shipments: {
    ship_code: string;
    ship_date: string | null;
    status: string | null;
    members: { name: string | null; client_code: string | null } | null;
  } | null;
};

export type ReceivableReportRow = {
  id: string;
  source: ReportSource;
  ship_code: string;
  ship_date: string | null;
  total: number;
  amt_recd: number;
  amt_outstanding: number;
  members: { name: string | null; client_code: string | null } | null;
};

function sortByShipDateDesc<T extends { shipments?: { ship_date?: string | null } | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const da = a.shipments?.ship_date ? new Date(a.shipments.ship_date).getTime() : 0;
    const db = b.shipments?.ship_date ? new Date(b.shipments.ship_date).getTime() : 0;
    return db - da;
  });
}

/** 出貨明細表：POS shipment_items + EasyStore customer_order_items（日期用 advance_date） */
export async function fetchShipmentReport(params: {
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as ShipmentReportRow[];

  let posQuery = supabase
    .from('shipment_items')
    .select(
      `
      id, product_name, qty, unit_price, subtotal,
      shipments!inner(
        ship_code, ship_date, currency, tax_type, taxrate,
        member_id, status,
        members(name, client_code)
      )
    `
    )
    .eq('shipments.user_id', user.id)
    .eq('shipments.status', 'valid')
    .order('ship_date', { foreignTable: 'shipments', ascending: false });

  if (params.dateFrom) posQuery = posQuery.gte('shipments.ship_date', params.dateFrom);
  if (params.dateTo) posQuery = posQuery.lte('shipments.ship_date', params.dateTo);
  if (params.memberId) posQuery = posQuery.eq('shipments.member_id', params.memberId);

  const { data: posData } = await posQuery;

  let coQuery = supabase
    .from('customer_order_items')
    .select(
      `
      id, product_name, qty, unit_price, subtotal,
      customer_orders!inner(
        order_code, advance_date, currency, tax_type, taxrate,
        member_id, status,
        members(name, client_code)
      )
    `
    )
    .eq('customer_orders.user_id', user.id)
    .neq('customer_orders.status', 'cancelled')
    .order('advance_date', { foreignTable: 'customer_orders', ascending: false });

  if (params.dateFrom) coQuery = coQuery.gte('customer_orders.advance_date', params.dateFrom);
  if (params.dateTo) coQuery = coQuery.lte('customer_orders.advance_date', params.dateTo);
  if (params.memberId) coQuery = coQuery.eq('customer_orders.member_id', params.memberId);

  const { data: coData } = await coQuery;

  const posRows: ShipmentReportRow[] = (posData ?? []).map((row: Record<string, unknown>) => ({
    id: `pos-${row.id}`,
    source: 'POS' as const,
    product_name: String(row.product_name ?? ''),
    qty: Number(row.qty ?? 0),
    unit_price: Number(row.unit_price ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    shipments: row.shipments as ShipmentReportRow['shipments'],
  }));

  const coRows: ShipmentReportRow[] = (coData ?? []).map((row: Record<string, unknown>) => {
    const o = row.customer_orders as Record<string, unknown>;
    return {
      id: `co-${row.id}`,
      source: 'EasyStore' as const,
      product_name: String(row.product_name ?? ''),
      qty: Number(row.qty ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      subtotal: Number(row.subtotal ?? 0),
      shipments: {
        ship_code: String(o?.order_code ?? ''),
        ship_date: (o?.advance_date as string | null) ?? null,
        currency: (o?.currency as string | null) ?? null,
        tax_type: (o?.tax_type as string | null) ?? null,
        taxrate: o?.taxrate != null ? Number(o.taxrate) : null,
        member_id: (o?.member_id as string | null) ?? null,
        status: (o?.status as string | null) ?? null,
        members: (o?.members ?? null) as { name: string | null; client_code: string | null } | null,
      },
    };
  });

  return sortByShipDateDesc([...posRows, ...coRows]);
}

/** 毛利報表：合併 POS + 客戶訂單明細（含採購單價） */
export async function fetchProfitReport(params: {
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as ProfitReportRow[];

  let posQuery = supabase
    .from('shipment_items')
    .select(
      `
      id, product_name, qty, unit_price, subtotal,
      products(purchase_price),
      shipments!inner(
        ship_code, ship_date, status,
        members(name, client_code)
      )
    `
    )
    .eq('shipments.user_id', user.id)
    .eq('shipments.status', 'valid')
    .order('ship_date', { foreignTable: 'shipments', ascending: false });

  if (params.dateFrom) posQuery = posQuery.gte('shipments.ship_date', params.dateFrom);
  if (params.dateTo) posQuery = posQuery.lte('shipments.ship_date', params.dateTo);
  if (params.memberId) posQuery = posQuery.eq('shipments.member_id', params.memberId);

  const { data: posData } = await posQuery;

  let coQuery = supabase
    .from('customer_order_items')
    .select(
      `
      id, product_name, qty, unit_price, subtotal,
      product_id,
      products(purchase_price),
      customer_orders!inner(
        order_code, advance_date, status,
        members(name, client_code)
      )
    `
    )
    .eq('customer_orders.user_id', user.id)
    .neq('customer_orders.status', 'cancelled')
    .order('advance_date', { foreignTable: 'customer_orders', ascending: false });

  if (params.dateFrom) coQuery = coQuery.gte('customer_orders.advance_date', params.dateFrom);
  if (params.dateTo) coQuery = coQuery.lte('customer_orders.advance_date', params.dateTo);
  if (params.memberId) coQuery = coQuery.eq('customer_orders.member_id', params.memberId);

  const { data: coData } = await coQuery;

  const posRows: ProfitReportRow[] = (posData ?? []).map((row: Record<string, unknown>) => ({
    id: `pos-${row.id}`,
    source: 'POS' as const,
    product_name: String(row.product_name ?? ''),
    qty: Number(row.qty ?? 0),
    unit_price: Number(row.unit_price ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    products: row.products as ProfitReportRow['products'],
    shipments: row.shipments as ProfitReportRow['shipments'],
  }));

  const coRows: ProfitReportRow[] = (coData ?? []).map((row: Record<string, unknown>) => {
    const o = row.customer_orders as Record<string, unknown>;
    return {
      id: `co-${row.id}`,
      source: 'EasyStore' as const,
      product_name: String(row.product_name ?? ''),
      qty: Number(row.qty ?? 0),
      unit_price: Number(row.unit_price ?? 0),
      subtotal: Number(row.subtotal ?? 0),
      products: row.products as ProfitReportRow['products'],
      shipments: {
        ship_code: String(o?.order_code ?? ''),
        ship_date: (o?.advance_date as string | null) ?? null,
        status: (o?.status as string | null) ?? null,
        members: (o?.members ?? null) as { name: string | null; client_code: string | null } | null,
      },
    };
  });

  return sortByShipDateDesc([...posRows, ...coRows]);
}

/** 應收帳款明細：shipments + customer_orders（未收 = total - amt_recd） */
export async function fetchReceivableReport(params: {
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [] as ReceivableReportRow[];

  let shipQuery = supabase
    .from('shipments')
    .select(
      `
      id, ship_code, ship_date, total, amt_recd, amt_outstanding,
      members(name, client_code)
    `
    )
    .eq('user_id', user.id)
    .eq('status', 'valid')
    .order('ship_date', { ascending: false });

  if (params.dateFrom) shipQuery = shipQuery.gte('ship_date', params.dateFrom);
  if (params.dateTo) shipQuery = shipQuery.lte('ship_date', params.dateTo);
  if (params.memberId) shipQuery = shipQuery.eq('member_id', params.memberId);

  const { data: shipData } = await shipQuery;

  let coQuery = supabase
    .from('customer_orders')
    .select(`id, order_code, advance_date, total, amt_recd, members(name, client_code)`)
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('advance_date', { ascending: false });

  if (params.dateFrom) coQuery = coQuery.gte('advance_date', params.dateFrom);
  if (params.dateTo) coQuery = coQuery.lte('advance_date', params.dateTo);
  if (params.memberId) coQuery = coQuery.eq('member_id', params.memberId);

  const { data: coData } = await coQuery;

  const posRows: ReceivableReportRow[] = (shipData ?? []).map((row: Record<string, unknown>) => ({
    id: `pos-${row.id}`,
    source: 'POS' as const,
    ship_code: String(row.ship_code ?? ''),
    ship_date: (row.ship_date as string | null) ?? null,
    total: Number(row.total ?? 0),
    amt_recd: Number(row.amt_recd ?? 0),
    amt_outstanding: Number(row.amt_outstanding ?? 0),
    members: row.members as ReceivableReportRow['members'],
  }));

  const coRows: ReceivableReportRow[] = (coData ?? []).map((row: Record<string, unknown>) => {
    const total = Number(row.total ?? 0);
    const recd = Number(row.amt_recd ?? 0);
    return {
      id: `co-${row.id}`,
      source: 'EasyStore' as const,
      ship_code: String(row.order_code ?? ''),
      ship_date: (row.advance_date as string | null) ?? null,
      total,
      amt_recd: recd,
      amt_outstanding: Math.max(0, total - recd),
      members: row.members as ReceivableReportRow['members'],
    };
  });

  return [...posRows, ...coRows].sort((a, b) => {
    const da = a.ship_date ? new Date(a.ship_date).getTime() : 0;
    const db = b.ship_date ? new Date(b.ship_date).getTime() : 0;
    return db - da;
  });
}
