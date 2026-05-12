/**
 * 發票字軌 Server Actions
 * 表：invoice_track_numbers
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';

export interface InvoiceSequence {
  id: string;
  user_id: string;
  track_prefix: string;
  year_month: string;
  start_number: number;
  end_number: number;
  current_number: number;
  is_active: boolean;
  created_at: string;
}

export type InvoiceSequenceInput = {
  track_prefix: string;
  year_month: string;
  start_number: number;
  end_number: number;
};

function rowToSequence(row: Record<string, unknown>): InvoiceSequence {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    track_prefix: String(row.track_prefix),
    year_month: String(row.year_month),
    start_number: Number(row.start_number),
    end_number: Number(row.end_number),
    current_number: Number(row.current_number),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

/**
 * 取得所有字軌列表（當前使用者）
 */
export async function fetchInvoiceSequences(): Promise<InvoiceSequence[]> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from('invoice_track_numbers')
    .select('*')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchInvoiceSequences:', error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => rowToSequence(r));
}

/**
 * 新增字軌（預設不啟用，避免觸發唯一約束）
 */
export async function createInvoiceSequence(
  data: InvoiceSequenceInput
): Promise<{ id: string } | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '未登入' };

  const { track_prefix, year_month, start_number, end_number } = data;
  if (!track_prefix?.trim()) return { error: '請輸入字軌前綴' };
  if (!year_month?.trim()) return { error: '請輸入期別' };
  if (start_number == null || end_number == null || start_number > end_number) {
    return { error: '起始號與結束號需合理（起始 ≤ 結束）' };
  }

  const { data: row, error } = await supabase
    .from('invoice_track_numbers')
    .insert({
      user_id: ownerId,
      track_prefix: track_prefix.trim().toUpperCase(),
      year_month: year_month.trim(),
      start_number,
      end_number,
      current_number: start_number,
      is_active: false,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: '同一期別或前綴可能已存在' };
    return { error: error.message };
  }
  return { id: String(row.id) };
}

/**
 * 編輯字軌（含啟用/停用）。啟用時會先將同 user 其他字軌設為停用。
 */
export async function updateInvoiceSequence(
  id: string,
  data: Partial<InvoiceSequenceInput> & { is_active?: boolean; current_number?: number }
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '未登入' };

  const { data: existing } = await supabase
    .from('invoice_track_numbers')
    .select('id')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  if (!existing) return { error: '字軌不存在或無權限' };

  if (data.is_active === true) {
    await supabase
      .from('invoice_track_numbers')
      .update({ is_active: false })
      .eq('user_id', ownerId);
  }

  const updates: Record<string, unknown> = {};
  if (data.track_prefix !== undefined) updates.track_prefix = data.track_prefix.trim().toUpperCase();
  if (data.year_month !== undefined) updates.year_month = data.year_month.trim();
  if (data.start_number !== undefined) updates.start_number = data.start_number;
  if (data.end_number !== undefined) updates.end_number = data.end_number;
  if (data.current_number !== undefined) updates.current_number = data.current_number;
  if (data.is_active !== undefined) updates.is_active = data.is_active;

  const { error } = await supabase
    .from('invoice_track_numbers')
    .update(updates)
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * 刪除字軌。若該字軌已被用於開立發票（invoices 表有對應），則不允許刪除。
 */
export async function deleteInvoiceSequence(id: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '未登入' };

  const { data: seq } = await supabase
    .from('invoice_track_numbers')
    .select('id')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  if (!seq) return { error: '字軌不存在或無權限' };

  const { data: trackRow } = await supabase
    .from('invoice_track_numbers')
    .select('track_prefix')
    .eq('id', id)
    .eq('user_id', ownerId)
    .single();

  if (trackRow) {
    const prefix = String(trackRow.track_prefix);
    const { data: used } = await supabase
      .from('invoices')
      .select('id')
      .eq('user_id', ownerId)
      .like('invoice_number', `${prefix}%`)
      .limit(1)
      .maybeSingle();
    if (used) return { error: '此字軌已開立過發票，不可刪除' };
  }

  const { error } = await supabase
    .from('invoice_track_numbers')
    .delete()
    .eq('id', id)
    .eq('user_id', ownerId);

  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * 取下一個流水號（原子操作，呼叫 RPC）
 * 回傳完整發票號碼字串，例如 AB00000123
 */
export async function getNextInvoiceNumber(sequenceId: string): Promise<{ number: string } | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '未登入' };

  const { data: seq } = await supabase
    .from('invoice_track_numbers')
    .select('id')
    .eq('id', sequenceId)
    .eq('user_id', ownerId)
    .single();

  if (!seq) return { error: '字軌不存在或無權限' };

  const { data, error } = await supabase.rpc('get_next_invoice_number', { p_track_id: sequenceId });

  if (error) return { error: error.message };
  return { number: String(data) };
}
