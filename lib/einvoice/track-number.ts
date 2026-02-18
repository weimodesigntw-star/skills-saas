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
  track_prefix: string;
  year_month: string;
  start_number: number;
  end_number: number;
  current_number: number;
  is_active: boolean;
  created_at: string;
}

/**
 * 取得下一個可用的發票號碼
 *
 * 流程：
 * 1. 查詢使用者的第一個有效字軌
 * 2. 檢查是否還有號碼可用
 * 3. 自動遞增 current_number
 * 4. 返回格式化的發票號碼
 *
 * @param userId - 使用者 ID
 * @returns 格式化的發票號碼 (AB-12345678)
 * @throws 如果沒有可用字軌或號碼已用完
 */
export async function getNextInvoiceNumber(userId: string): Promise<string> {
  const supabase = createServerClient();

  try {
    // 取得使用者的有效字軌（優先取得 current_number < end_number 的）
    const { data: track, error: trackError } = await supabase
      .from('invoice_track_numbers')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .lt('current_number', 'end_number')  // 確保還有號碼可用
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (trackError || !track) {
      throw new Error(
        '尚未設定發票字軌，請先到設定頁面新增字軌'
      );
    }

    const invoiceTrack = track as InvoiceTrackNumber;

    // 檢查號碼是否已用完
    if (invoiceTrack.current_number >= invoiceTrack.end_number) {
      throw new Error(
        `發票號碼已用完（${invoiceTrack.track_prefix} 字軌），請新增新字軌`
      );
    }

    // 計算下一個號碼
    const nextNumber = invoiceTrack.current_number + 1;

    // 更新資料庫中的 current_number
    const { error: updateError } = await supabase
      .from('invoice_track_numbers')
      .update({ current_number: nextNumber })
      .eq('id', invoiceTrack.id);

    if (updateError) {
      throw new Error(`更新字軌失敗: ${updateError.message}`);
    }

    // 格式化號碼：前綴 + 8 位數字（用 0 補齊）
    const formattedNumber = formatInvoiceNumber(
      invoiceTrack.track_prefix,
      nextNumber
    );

    return formattedNumber;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`取得發票號碼失敗: ${error.message}`);
    }
    throw new Error('取得發票號碼失敗: 未知錯誤');
  }
}

/**
 * 格式化發票號碼
 * 格式：AB-12345678 (2字母前綴 + 連字號 + 8位數字)
 *
 * @param prefix - 字軌前綴 (e.g., "AB")
 * @param number - 號碼 (e.g., 1)
 * @returns 格式化的發票號碼
 */
export function formatInvoiceNumber(prefix: string, number: number): string {
  const paddedNumber = String(number).padStart(8, '0');
  return `${prefix}-${paddedNumber}`;
}

/**
 * 解析發票號碼，反向取得前綴和號碼
 *
 * @param invoiceNumber - 完整發票號碼 (AB-12345678)
 * @returns { prefix, number }
 */
export function parseInvoiceNumber(
  invoiceNumber: string
): { prefix: string; number: number } {
  const parts = invoiceNumber.split('-');
  if (parts.length !== 2) {
    throw new Error('發票號碼格式無效');
  }

  const prefix = parts[0];
  const number = parseInt(parts[1], 10);

  if (isNaN(number)) {
    throw new Error('發票號碼格式無效');
  }

  return { prefix, number };
}

/**
 * 新增發票字軌
 *
 * @param userId - 使用者 ID
 * @param prefix - 字軌前綴 (2 個字母)
 * @param yearMonth - 期別 (e.g., "11502" for 114年1-2月)
 * @param startNumber - 起始號碼
 * @param endNumber - 結束號碼
 * @returns 新增的字軌記錄
 */
export async function addInvoiceTrack(
  userId: string,
  prefix: string,
  yearMonth: string,
  startNumber: number,
  endNumber: number
): Promise<InvoiceTrackNumber> {
  const supabase = createServerClient();

  // 驗証前綴格式
  if (!/^[A-Z]{2}$/.test(prefix)) {
    throw new Error('字軌前綴必須為 2 個大寫英文字母');
  }

  // 驗証號碼範圍
  if (startNumber <= 0 || endNumber <= startNumber) {
    throw new Error('起始號碼和結束號碼範圍無效');
  }

  try {
    const { data, error } = await supabase
      .from('invoice_track_numbers')
      .insert({
        user_id: userId,
        track_prefix: prefix,
        year_month: yearMonth,
        start_number: startNumber,
        end_number: endNumber,
        current_number: startNumber - 1,  // 初始值為 start - 1，首次調用時會變成 start
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`新增字軌失敗: ${error.message}`);
    }

    return data as InvoiceTrackNumber;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('新增字軌失敗: 未知錯誤');
  }
}

/**
 * 取得使用者的所有字軌
 *
 * @param userId - 使用者 ID
 * @returns 字軌列表
 */
export async function getUserInvoiceTracks(
  userId: string
): Promise<InvoiceTrackNumber[]> {
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('invoice_track_numbers')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`查詢字軌失敗: ${error.message}`);
    }

    return (data as InvoiceTrackNumber[]) || [];
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('查詢字軌失敗: 未知錯誤');
  }
}

/**
 * 停用字軌
 *
 * @param trackId - 字軌 ID
 */
export async function deactivateInvoiceTrack(trackId: string): Promise<void> {
  const supabase = createServerClient();

  try {
    const { error } = await supabase
      .from('invoice_track_numbers')
      .update({ is_active: false })
      .eq('id', trackId);

    if (error) {
      throw new Error(`停用字軌失敗: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('停用字軌失敗: 未知錯誤');
  }
}

/**
 * 啟用字軌
 *
 * @param trackId - 字軌 ID
 */
export async function activateInvoiceTrack(trackId: string): Promise<void> {
  const supabase = createServerClient();

  try {
    const { error } = await supabase
      .from('invoice_track_numbers')
      .update({ is_active: true })
      .eq('id', trackId);

    if (error) {
      throw new Error(`啟用字軌失敗: ${error.message}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('啟用字軌失敗: 未知錯誤');
  }
}
