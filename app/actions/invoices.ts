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
import { getNextInvoiceNumber, parseInvoiceNumber } from '@/lib/einvoice/track-number';
import {
  buildInvoicePayload,
  issueInvoice,
  voidInvoice as voidInvoiceECPay,
  InvoiceItem,
} from '@/lib/einvoice/ecpay';
import { formatNTD } from '@/lib/constants';
import { Order, OrderItem } from '@/lib/types/pos';

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
      '愛心碼必須為 3-7 位數字'
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '未授權' };
    }

    // 查詢訂單
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
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
      invoiceNumber = await getNextInvoiceNumber(user.id);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知錯誤';
      return { success: false, error: `取得發票號碼失敗: ${msg}` };
    }

    // 組裝發票明細項（轉換為 ECPay 格式）
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
    const ecpayResult = await issueInvoice(
      payload,
      process.env.ECPAY_HASH_KEY,
      process.env.ECPAY_HASH_IV
    );

    // 存入資料庫
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        order_id: orderId,
        user_id: user.id,
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: '未授權' };
    }

    // 查詢發票
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
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

    // 呼叫 ECPay 作廢 API
    const ecpayResult = await voidInvoiceECPay(
      invoiceRecord.invoice_number,
      reason,
      process.env.ECPAY_HASH_KEY,
      process.env.ECPAY_HASH_IV
    );

    // 更新資料庫
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: 'voided',
        void_reason: reason,
        void_date: new Date().toISOString(),
        einvoice_status: ecpayResult.success ? 'uploaded' : 'failed',
        einvoice_response: ecpayResult.rawResponse || null,
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

/**
 * 取得發票列表（分頁）
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
  const supabase = createServerClient();

  try {
    // 取得當前使用者
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { invoices: [], total: 0, error: '未授權' };
    }

    // 構建查詢
    let query = supabase
      .from('invoices')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('invoice_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('invoice_date', dateTo);
    }

    const { data, count, error } = await query;

    if (error) {
      return {
        invoices: [],
        total: 0,
        error: `查詢失敗: ${error.message}`,
      };
    }

    return {
      invoices: (data as InvoiceRow[]) || [],
      total: count || 0,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : '未知錯誤';
    return {
      invoices: [],
      total: 0,
      error: `查詢發票失敗: ${msg}`,
    };
  }
}

/**
 * 取得發票詳情（含訂單資訊）
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { error: '未授權' };
    }

    // 查詢發票
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('user_id', user.id)
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
      .eq('user_id', user.id)
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
