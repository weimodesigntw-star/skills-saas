'use server';

import { createServerClient } from '@/lib/supabase/server';

export type ShipmentReportRow = {
  id: string;
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
  ship_code: string;
  ship_date: string | null;
  total: number;
  amt_recd: number;
  amt_outstanding: number;
  members: { name: string | null; client_code: string | null } | null;
};

/** 出貨明細表：shipment_items + shipments + members */
export async function fetchShipmentReport(params: {
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [] as ShipmentReportRow[];

  let query = supabase
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

  if (params.dateFrom) query = query.gte('shipments.ship_date', params.dateFrom);
  if (params.dateTo) query = query.lte('shipments.ship_date', params.dateTo);
  if (params.memberId) query = query.eq('shipments.member_id', params.memberId);

  const { data } = await query;
  return ((data ?? []) as unknown) as ShipmentReportRow[];
}

/** 毛利報表：出貨明細 + 商品採購單價 */
export async function fetchProfitReport(params: {
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [] as ProfitReportRow[];

  let query = supabase
    .from('shipment_items')
    .select(
      `
      product_name, qty, unit_price, subtotal,
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

  if (params.dateFrom) query = query.gte('shipments.ship_date', params.dateFrom);
  if (params.dateTo) query = query.lte('shipments.ship_date', params.dateTo);
  if (params.memberId) query = query.eq('shipments.member_id', params.memberId);

  const { data } = await query;
  return ((data ?? []) as unknown) as ProfitReportRow[];
}

/** 應收帳款明細表：shipments 層級，已收/未收 */
export async function fetchReceivableReport(params: {
  dateFrom?: string;
  dateTo?: string;
  memberId?: string;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [] as ReceivableReportRow[];

  let query = supabase
    .from('shipments')
    .select(
      `
      ship_code, ship_date, total, amt_recd, amt_outstanding,
      members(name, client_code)
    `
    )
    .eq('user_id', user.id)
    .eq('status', 'valid')
    .order('ship_date', { ascending: false });

  if (params.dateFrom) query = query.gte('ship_date', params.dateFrom);
  if (params.dateTo) query = query.lte('ship_date', params.dateTo);
  if (params.memberId) query = query.eq('member_id', params.memberId);

  const { data } = await query;
  return ((data ?? []) as unknown) as ReceivableReportRow[];
}
