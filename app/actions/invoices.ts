/**
 * Invoice Server Actions
 *
 * 處理電子發票的伺服器端操作：
 * - 建立發票（完整流程：取號 → 組裝 → 呼叫 ECPay → 存資料庫）
 * - 作廢發票
 * - 查詢發票清單
 * - 取得發票詳情
 */

'use server';

import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';
import { getNextInvoiceNumber as getNextFromLegacy, parseInvoiceNumber } from '@/lib/einvoice/track-number';
import {
  buildInvoicePayload,
  issueInvoice as issueInvoiceECPay,
  voidInvoice as voidInvoiceECPay,
  InvoiceItem,
} from '@/lib/einvoice/ecpay';
import { formatNTD } from '@/lib/constants';
import { Order, OrderItem } from '@/lib/types/pos';
import { fetchInvoiceSequences, getNextInvoiceNumber as getNextFromSequence } from '@/app/actions/invoice-sequences';
import { ecpayIssueInvoice, ecpayVoidInvoice } from '@/lib/ecpay/invoice';

// ============================================
// Validation Schemas
// ============================================

const InvoiceInfoSchema = z.object({
  type: z.enum(['B2C', 'B2B']),
  buyerName: z.string().optional(),
  buyerIdentifier: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{8}$/.test(val),
      '統編必須為 8 位數字'
    ),
  carrierType: z
    .enum(['phone_barcode', 'cert', 'member'])
    .nullable()
    .optional(),
  carrierId: z.string().nullable().optional(),
  donateCode: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) => !val || /^\d{3,7}$/.test(val),
      '愛心碼必須炶 3-7 位數字'
    ),
});

type InvoiceInfo = z.infer<typeof InvoiceInfoSchema>;

interface InvoiceRow {
  id: string;
  order_id: string;
  user_id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  buyer_identifier: string;
  buyer_name: string | null;
  carrier_type: string | null;
  carrier_id: string | null;
  donate_mark: boolean;
  donate_code: string | null;
  sales_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  einvoice_status: string;
  einvoice_response: Record<string, any> | null;
  void_reason: string | null;
  void_date: string | null;
  created_at: string;
  updated_at: string;
  ecpay_invoice_number?: string | null;
  ecpay_random_number?: string | null;
}

// ============================================
// Server Actions
// ============================================

/**
 * 建立發票
 *
 * 完整流程：
 * 1. 驗証訂單存在
 * 2. 取得下一個發票號碼
 * 3. 組裝 ECPay Payload
 * 4. 呼叫 ECPay API
 * 5. 存入 invoices 表
 */
export async function createInvoice(
  orderId: string,
  invoiceInfo: InvoiceInfo
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  const supabase = createServerClient();

  try {
    // 驗証 invoiceInfo
    const validatedInfo = InvoiceInfoSchema.parse(invoiceInfo);

    // 取得當前使用者
    const { ownerId } = await getAuthAndWorkspace(supabase);
    if (!ownerId) {
      return { success: false, error: '未授權' };
    }

    // 查詢訂單
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', ownerId)
      .single();

    if (orderError || !order) {
      return { success: false, error: '訂單不存在' };
    }

    const orderRecord = order as Order;

    // 查詢訂單項目（用來組裝發票明細）
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError || !items) {
      return { success: false, error: '無法查詢訂單明細' };
    }

    // 取得下一個發票號碼
    let invoiceNumber: string;
    try {
      invoiceNumber = await getNextFromLegacy(ownerId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知錯誤';
      return { success: false, error: `取得癹票號碼失敗: ${msg}` };
    }

    // 組裝癹票明細項（轉換為 ECPay 格式）
    const invoiceItems: InvoiceItem[] = (items as OrderItem[]).map((item) => ({
      itemName: item.product_name,
      itemCount: item.quantity,
      itemWord: '個',
      itemPrice: item.unit_price,
      itemAmount: item.subtotal,
    }));

    // 組裝 Payload
    const now = new Date();
    const merchantTradeDate = now.toISOString().replace('T', ' ').slice(0, 19);

    const payload = buildInvoicePayload(
      {
        invoiceNumber,
        invoiceDate: now.toISOString().split('T')[0],
        totalAmount: orderRecord.total_amount,
        taxAmount: orderRecord.tax_amount,
        saleAmount: orderRecord.subtotal,
        items: invoiceItems,
        invoiceType: (validatedInfo.type || 'B2C') as 'B2C' | 'B2B',
        buyerIdentifier: validatedInfo.buyerIdentifier || '0000000000',
        buyerName: validatedInfo.buyerName,
        carrierType: validatedInfo.carrierType,
        carrierId: validatedInfo.carrierId,
        donateCode: validatedInfo.donateCode,
        print: 0,
        merchantOrderNo: orderId,
      },
      process.env.ECPAY_MERCHANT_ID || '',
      merchantTradeDate
    );

    // 呼叫 ECPay API
    const ecpayResult = await issueInvoiceECPay(
      payload,
      process.env.ECPAY_HASH_KEY,
      process.env.ECPAY_HASH_IV
    );

    // 存入資料庫
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        order_id: orderId,
        user_id: ownerId,
        invoice_number: invoiceNumber,
        invoice_date: now.toISOString().split('T')[0],
        invoice_type: validatedInfo.type || 'B2C',
        buyer_identifier: validatedInfo.buyerIdentifier || '0000000000',
        buyer_name: validatedInfo.buyerName || null,
        carrier_type: validatedInfo.carrierType || null,
        carrier_id: validatedInfo.carrierId || null,
        donate_mark: !!validatedInfo.donateCode,
        donate_code: validatedInfo.donateCode || null,
        sales_amount: orderRecord.subtotal,
        tax_amount: orderRecord.tax_amount,
        total_amount: orderRecord.total_amount,
        status: 'issued',
        einvoice_status: ecpayResult.success ? 'uploaded' : 'failed',
        einvoice_response: ecpayResult.rawResponse || null,
      })
      .select()
      .single();

    if (invoiceError) {
      return {
        success: false,
        error: `發票存檔失敗: ${invoiceError.message}`,
      };
    }

    return {
      success: true,
      invoiceId: invoice.id,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return {
      success: false,
      error: `建立發票失敗: ${msg}`,
    };
  }
}

/**
 * 作廢發票
 */
export async function voidInvoice(
  invoiceId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();

  try {
    // 取得當前使用者
    const { ownerId } = await getAuthAndWorkspace(supabase);
    if (!ownerId) {
      return { success: false, error: '未授權' };
    }

    // 查詢發票
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', ownerId)
      .single();

    if (invoiceError || !invoice) {
      return { success: false, error: '發票不存在' };
    }

    const invoiceRecord = invoice as InvoiceRow;

    // 檢查發票狀態
    if (invoiceRecord.status !== 'issued') {
      return {
        success: false,
        error: `發票狀態為「${invoiceRecord.status}」，無法作廢`,
      };
    }

    // ECPay 作廢（P2-1）：有設定且此筆發票有 ecpay 號碼時呼叫 B2C 作廢 API
    const hasEcpay = !!(
      process.env.ECPAY_MERCHANT_ID &&
      process.env.ECPAY_HASH_KEY &&
      process.env.ECPAY_HASH_IV
    );
    let einvoiceStatus = 'pending';
    let einvoiceResponse: Record<string, unknown> | null = null;
    if (hasEcpay && (invoiceRecord as InvoiceRow).ecpay_invoice_number) {
      try {
        const invoiceDate =
          typeof invoiceRecord.invoice_date === 'string'
            ? invoiceRecord.invoice_date.slice(0, 10)
            : new Date(invoiceRecord.invoice_date).toISOString().slice(0, 10);
        const ecpayResult = await ecpayVoidInvoice({
          invoiceNumber: (invoiceRecord as InvoiceRow).ecpay_invoice_number!,
          invoiceDate,
          reason,
        });
        einvoiceStatus = ecpayResult.success ? 'uploaded' : 'failed';
        einvoiceResponse = ecpayResult.success ? {} : { error: ecpayResult.error };
      } catch {
        einvoiceStatus = 'failed';
      }
    } else if (process.env.ECPAY_HASH_KEY && process.env.ECPAY_HASH_IV) {
      try {
        const ecpayResult = await voidInvoiceECPay(
          invoiceRecord.invoice_number,
          reason,
          process.env.ECPAY_HASH_KEY,
          process.env.ECPAY_HASH_IV
        );
        einvoiceStatus = ecpayResult.success ? 'uploaded' : 'failed';
        einvoiceResponse = ecpayResult.rawResponse || null;
      } catch {
        einvoiceStatus = 'failed';
      }
    }

    // 更新資料庫
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'voided',
        void_reason: reason,
        void_date: new Date().toISOString(),
        einvoice_status: einvoiceStatus,
        einvoice_response: einvoiceResponse,
      })
      .eq('id', invoiceId);

    if (updateError) {
      return {
        success: false,
        error: `作廢失敗: ${updateError.message}`,
      };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return {
      success: false,
      error: `作廢發票失敗: ${msg}`,
    };
  }
}

/** 發票列表項（含對應訂單編號） */
export type InvoiceWithOrderNumber = InvoiceRow & { order_number?: string };

/**
 * 取得發票列表（分頁，含訂單編號）
 * page 1-based；status: '' | 'issued' | 'voided'
 */
export async function fetchInvoices(params: {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  invoices: InvoiceWithOrderNumber[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}> {
  const { status, dateFrom, dateTo, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createServerClient();

  try {
    const { ownerId } = await getAuthAndWorkspace(supabase);
    if (!ownerId) {
      return { invoices: [], total: 0, page, pageSize, error: '未授權' };
    }

    let query = supabase
      .from('invoices')
      .select('*, orders!order_id(order_number)', { count: 'exact' })
      .eq('user_id', ownerId)
      .order('invoice_date', { ascending: false })
      .range(from, to);

    if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('invoice_date', dateFrom);
    if (dateTo) query = query.lte('invoice_date', dateTo);

    const { data, count, error } = await query;
    if (error) {
      return { invoices: [], total: 0, page, pageSize, error: error.message };
    }

    const rows = (data ?? []) as (InvoiceRow & { orders: { order_number: string } | null })[];
    const invoices: InvoiceWithOrderNumber[] = rows.map((r) => {
      const { orders, ...inv } = r;
      return { ...inv, order_number: orders?.order_number ?? undefined };
    });

    return {
      invoices,
      total: count ?? 0,
      page,
      pageSize,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '查詢失敗';
    return { invoices: [], total: 0, page, pageSize, error: msg };
  }
}

/**
 * 取得發票列表（分頁）- 舊 API，保留相容
 */
export async function getInvoices(
  page = 0,
  pageSize = 20,
  status?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{
  invoices: InvoiceRow[];
  total: number;
  error?: string;
}> {
  const res = await fetchInvoices({
    status,
    dateFrom,
    dateTo,
    page: page + 1,
    pageSize,
  });
  return {
    invoices: res.invoices,
    total: res.total,
    error: res.error,
  };
}

/**
 * 取得發票詳情（含訂單資訊，重印用）
 */
export async function getInvoiceDetail(invoiceId: string): Promise<{
  invoice?: InvoiceRow;
  order?: Order;
  items?: OrderItem[];
  error?: string;
}> {
  const supabase = createServerClient();

  try {
    // 取得當前使用者
    const { ownerId } = await getAuthAndWorkspace(supabase);
    if (!ownerId) {
      return { error: '未授權' };
    }

    // 查詢發票
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', ownerId)
      .single();

    if (invoiceError || !invoice) {
      return { error: '發票不存在' };
    }

    const invoiceRecord = invoice as InvoiceRow;

    // 查詢訂單
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', invoiceRecord.order_id)
      .eq('user_id', ownerId)
      .single();

    if (orderError || !order) {
      return {
        invoice: invoiceRecord,
        error: '訂單不存在',
      };
    }

    // 查詢訂單項目
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', invoiceRecord.order_id);

    if (itemsError) {
      return {
        invoice: invoiceRecord,
        order: order as Order,
        error: '訂單明細查詢失敗',
      };
    }

    return {
      invoice: invoiceRecord,
      order: order as Order,
      items: (items as OrderItem[]) || [],
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return {
      error: `查詢發票詳情失敗: ${msg}`,
    };
  }
}

/** 依訂單 ID 取得該訂單的發票（若已開立） */
export async function getInvoiceByOrderId(orderId: string): Promise<InvoiceRow | null> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return null;

  const { data } = await supabase
    .from('invoices')
    .select('*')
    .eq('order_id', orderId)
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as InvoiceRow | null;
}

/**
 * P0-3 開立發票（僅寫 DB，使用 P0-4 字軌 RPC 取號）
 * 若設定 ECPay 環境變數則一併呼叫 ECPay 開立，失敗不擋流程、回傳 warning。
 * 無啟用字軌時回傳 { error: 'NO_ACTIVE_TRACK' }，前端需導向 /dashboard/pos/sequences
 */
export async function issueInvoice(
  orderId: string,
  buyerInfo?: { buyerName?: string; buyerTaxId?: string }
): Promise<{ invoice: InvoiceRow; warning?: string } | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '未登入' };

  const sequences = await fetchInvoiceSequences();
  const active = sequences.find((s) => s.is_active);
  if (!active) return { error: 'NO_ACTIVE_TRACK' };

  const nextResult = await getNextFromSequence(active.id);
  if ('error' in nextResult) return { error: nextResult.error };

  const invoiceNumber = nextResult.number;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('user_id', ownerId)
    .single();

  if (orderError || !order) return { error: '訂單不存在' };
  const orderRow = order as Record<string, unknown>;

  const subtotal = Number(orderRow.subtotal ?? orderRow.total_amount ?? 0);
  const taxAmount = Number(orderRow.tax_amount ?? 0);
  const totalAmount = Number(orderRow.total_amount ?? subtotal + taxAmount);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const { data: inv, error: insertError } = await supabase
    .from('invoices')
    .insert({
      order_id: orderId,
      user_id: ownerId,
      invoice_number: invoiceNumber,
      invoice_date: dateStr,
      invoice_type: 'B2C',
      buyer_identifier: buyerInfo?.buyerTaxId ?? '0000000000',
      buyer_name: buyerInfo?.buyerName ?? null,
      sales_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: 'issued',
      einvoice_status: 'pending',
    })
    .select()
    .single();

  if (insertError || !inv) return { error: insertError?.message ?? '寫入發票失敗' };

  await supabase
    .from('orders')
    .update({ invoice_number: invoiceNumber })
    .eq('id', orderId)
    .eq('user_id', ownerId);

  const hasEcpay = !!(process.env.ECPAY_MERCHANT_ID && process.env.ECPAY_HASH_KEY && process.env.ECPAY_HASH_IV);

  if (hasEcpay) {
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_price')
      .eq('order_id', orderId);

    const result = await ecpayIssueInvoice({
      invoiceNumber,
      buyerName: buyerInfo?.buyerName,
      buyerTaxId: buyerInfo?.buyerTaxId,
      items: (orderItems ?? []).map((i: { product_name: string; quantity: number; unit_price: number }) => ({
        name: i.product_name,
        qty: i.quantity,
        unitPrice: Number(i.unit_price),
      })),
      totalAmount,
    });

    if (result.success && (result.invoiceNo != null || result.randomNumber != null)) {
      await supabase
        .from('invoices')
        .update({
          ecpay_invoice_number: result.invoiceNo ?? null,
          ecpay_random_number: result.randomNumber ?? null,
        })
        .eq('id', inv.id);
    }

    if (!result.success) {
      return {
        invoice: inv as InvoiceRow,
        warning: `發票已開立但 ECPay 回報錯誤：${result.error}`,
      };
    }
  }

  return { invoice: inv as InvoiceRow };
}
