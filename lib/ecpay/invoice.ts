/**
 * ECPay B2C 電子發票 API 串接（P2-1）
 *
 * - 開立：einvoice-stage.ecpay.com.tw / einvoice.ecpay.com.tw 的 B2CInvoice/Issue
 * - 作廢：同上 IssueInvalid
 * - CheckMacValue：參數 A-Z 排序 → HashKey+params+HashIV → URL encode → 小寫 → SHA256 → 大寫
 */

import { createHash } from 'crypto';

const SANDBOX_ISSUE = 'https://einvoice-stage.ecpay.com.tw/B2CInvoice/Issue';
const SANDBOX_VOID = 'https://einvoice-stage.ecpay.com.tw/B2CInvoice/IssueInvalid';
const PROD_ISSUE = 'https://einvoice.ecpay.com.tw/B2CInvoice/Issue';
const PROD_VOID = 'https://einvoice.ecpay.com.tw/B2CInvoice/IssueInvalid';

function getBaseUrl(): { issue: string; void: string } {
  const env = (process.env.ECPAY_ENV || 'sandbox').toLowerCase();
  if (env === 'production') {
    return { issue: PROD_ISSUE, void: PROD_VOID };
  }
  return { issue: SANDBOX_ISSUE, void: SANDBOX_VOID };
}

/** 依 ECPay 規則：排序 → HashKey+data+HashIV → urlencode → 小寫 → SHA256 → 大寫 */
function computeCheckMacValue(
  params: Record<string, string | number | undefined>,
  hashKey: string,
  hashIV: string
): string {
  const sorted = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  const data = sorted.map(([k, v]) => `${k}=${v}`).join('&');
  const raw = `HashKey=${hashKey}&${data}&HashIV=${hashIV}`;
  const encoded = encodeURIComponent(raw).toLowerCase();
  return createHash('sha256').update(encoded).digest('hex').toUpperCase();
}

/** 解析回傳 querystring：RtnCode=1&InvoiceNo=AB00000001&... */
function parseResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(text);
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export interface EcpayIssueParams {
  invoiceNumber: string;
  buyerName?: string;
  buyerTaxId?: string;
  items: { name: string; qty: number; unitPrice: number }[];
  totalAmount: number;
}

export interface EcpayIssueResult {
  success: boolean;
  invoiceNo?: string;
  randomNumber?: string;
  error?: string;
}

/**
 * 開立 B2C 電子發票
 */
export async function ecpayIssueInvoice(params: EcpayIssueParams): Promise<EcpayIssueResult> {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;

  if (!merchantId || !hashKey || !hashIV) {
    return { success: false, error: 'ECPay 環境變數未設定' };
  }

  const { issue: url } = getBaseUrl();
  const now = new Date();
  const invoiceDate = now.toISOString().slice(0, 10).replace(/-/g, '/'); // YYYY/MM/DD
  const invoiceTime = now.toTimeString().slice(0, 8); // HH:mm:ss

  const itemNames = params.items.map((i) => i.name).join('|');
  const itemCounts = params.items.map((i) => i.qty).join('|');
  const itemWords = params.items.map(() => '個').join('|');
  const itemPrices = params.items.map((i) => i.unitPrice).join('|');
  const itemAmounts = params.items.map((i) => i.qty * i.unitPrice).join('|');

  const salesAmount = params.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const taxAmount = Math.round((params.totalAmount - salesAmount) * 100) / 100;

  const body: Record<string, string | number> = {
    MerchantID: merchantId,
    RelateNumber: params.invoiceNumber,
    CustomerIdentifier: params.buyerTaxId || '0000000000',
    CustomerName: params.buyerName || '',
    InvoiceDate: invoiceDate,
    InvoiceTime: invoiceTime,
    SalesAmount: salesAmount,
    TaxAmount: taxAmount,
    TotalAmount: params.totalAmount,
    ItemName: itemNames,
    ItemCount: itemCounts,
    ItemWord: itemWords,
    ItemPrice: itemPrices,
    ItemAmount: itemAmounts,
  };

  const checkMacValue = computeCheckMacValue(
    { ...body } as Record<string, string>,
    hashKey,
    hashIV
  );
  body.CheckMacValue = checkMacValue;

  try {
    const formBody = new URLSearchParams();
    Object.entries(body).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        formBody.append(k, String(v));
      }
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    const text = await res.text();
    const result = parseResponse(text);
    const rtnCode = result.RtnCode ?? result.rtnCode ?? '';

    if (rtnCode === '1') {
      return {
        success: true,
        invoiceNo: result.InvoiceNo ?? result.InvoiceNumber,
        randomNumber: result.RandomNumber,
      };
    }

    return {
      success: false,
      error: result.RtnMsg ?? result.rtnMsg ?? '開立失敗',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `發票開立異常: ${msg}` };
  }
}

export interface EcpayVoidParams {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  reason: string;
}

export interface EcpayVoidResult {
  success: boolean;
  error?: string;
}

/**
 * 作廢 B2C 電子發票
 */
export async function ecpayVoidInvoice(params: EcpayVoidParams): Promise<EcpayVoidResult> {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;

  if (!merchantId || !hashKey || !hashIV) {
    return { success: false, error: 'ECPay 環境變數未設定' };
  }

  const { void: url } = getBaseUrl();
  const body: Record<string, string> = {
    MerchantID: merchantId,
    InvoiceNo: params.invoiceNumber,
    InvoiceDate: params.invoiceDate.replace(/-/g, '/'), // YYYY-MM-DD -> YYYY/MM/DD
    Reason: params.reason,
  };

  const checkMacValue = computeCheckMacValue(body, hashKey, hashIV);
  body.CheckMacValue = checkMacValue;

  try {
    const formBody = new URLSearchParams(body);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    });

    const text = await res.text();
    const result = parseResponse(text);
    const rtnCode = result.RtnCode ?? result.rtnCode ?? '';

    if (rtnCode === '1') {
      return { success: true };
    }

    return {
      success: false,
      error: result.RtnMsg ?? result.rtnMsg ?? '作廢失敗',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `發票作廢異常: ${msg}` };
  }
}
