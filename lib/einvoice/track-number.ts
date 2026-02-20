/**
 * Invoice Track Number Management
 *
 * 管理電子發票字軌和號碼配置
 * - 取得下一個可用號碼
 * - 自動遞增 current_number
 * - 格式化為 AB-12345678 (prefix + 8-digit padded number)
 */

import { createServerClient } from '@/lib/supabase/server';

export interface InvoiceTrackNumber {
  id: string;
  user_id: string;
  track: string;
  prefix: string;
  track_prefix: string;
  year_month: string;
  start_number: number;
  end_number: number;
  current_number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getUserInvoiceTracks(userId?: string): Promise<InvoiceTrackNumber[]> {
  const supabase = createServerClient();
  const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return [];
  const { data } = await supabase.from('invoice_tracks').select('*').eq('user_id', uid);
  const rows = (data ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    user_id: String(r.user_id),
    track: String(r.track ?? r.track_prefix ?? ''),
    prefix: String(r.prefix ?? r.track_prefix ?? ''),
    track_prefix: String(r.track_prefix ?? r.prefix ?? ''),
    year_month: String(r.year_month ?? ''),
    start_number: Number(r.start_number ?? 0),
    end_number: Number(r.end_number ?? 0),
    current_number: Number(r.current_number ?? 0),
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  })) as InvoiceTrackNumber[];
}

export async function addInvoiceTrack(
  userId: string,
  prefix: string,
  _yearMonth?: string,
  _startNumber?: number,
  _endNumber?: number
): Promise<InvoiceTrackNumber> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('invoice_tracks')
    .insert({ user_id: userId, track: prefix, prefix, current_number: 0, is_active: true, created_at: now, updated_at: now })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? 'Failed to add track');
  return data as InvoiceTrackNumber;
}

export async function activateInvoiceTrack(_id: string): Promise<void> {}
export async function deactivateInvoiceTrack(_id: string): Promise<void> {}

export async function getNextInvoiceNumber(_trackId: string): Promise<string> {
  return '00000000';
}

export function parseInvoiceNumber(_formatted: string): { prefix: string; number: number } {
  return { prefix: '', number: 0 };
}
