/**
 * ECPay E-Invoice Module
 *
 * 使用 Node.js 內置 crypto 模組，無外部加密依賴
 * 實現綠界電子發票 API 串接：
 * - 開立發票 (Issue)
 * - 作廢發票 (Void)
 * - 開立折讓 (Allowance)
 *
 * MIG 4.1 規格：符合財政部最新電子發票標準
 */

import { createCipheriv, createHmac, randomBytes } from 'crypto';

// ============================================
// Type Definitions
// ============================================

export interface InvoiceItem {
  itemName: string;
  itemCount: number;
  itemWord: string;      // 單位 (個、組、張等)
  itemPrice: number;
  itemAmount: number;    // itemCount * itemPrice
  itemTaxType?: 'Taxable' | 'Zero' | 'Free';  // 預設 Taxable
}

export interface BuildInvoicePayloadInput {
  invoiceNumber: string;           // AB-12345678 格式
  invoiceDate: string;             // YYYY-MM-DD
  totalAmount: number;             // 含稅總額
  taxAmount: number;               // 稅額
  saleAmount: number;              // 銷售額（未稅）
  items: InvoiceItem[];
  invoiceType: 'B2C' | 'B2B';      // 07 (B2C) 或 08 (B2B)
  buyerIdentifier: string;         // 統編（B2C 為 0000000000，B2B 為 8 碼）
  buyerName?: string;              // 買方名稱（B2B 填寫）
  carrierType?: 'phone_barcode' | 'cert' | 'member' | null;  // 載具類型
  carrierId?: string | null;       // 載具編號
  donateCode?: string | null;      // 愛心碼
  print: 0 | 1;                    // 0=不列印, 1=列印
  merchantOrderNo?: string;        // 商家訂單號（用於追蹤）
}

export interface ECPayPayload {
  MerchantID: string;
  MerchantTradeNo: string;
  MerchantTradeDate: string;
  TotalAmount: number;
  TradeDesc: string;
  ItemName: string;
  ReturnURL: string;
  ChoosePayment: string;
  EncryptType: number;
  CheckMacValue?: string;
  // 電子發票參數
  InvType?: string;
  CustomerIdentifier?: string;
  CustomerName?: string;
  Print?: 0 | 1;
  Donation?: 0 | 1;
  CarrierType?: string;
  CarrierId?: string;
  TaxAmount?: number;
  SaleAmount?: number;
}

export interface IssueInvoicePayload extends ECPayPayload {
  InvType: string;
  CustomerIdentifier: string;
  Print: 0 | 1;
}

export interface IssueInvoiceResponse {
  success: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  einvoiceStatus?: 'uploaded' | 'failed';
  rawResponse?: Record<string, any>;
  error?: string;
  errorCode?: string;
}

export interface VoidInvoicePayload {
  MerchantID: string;
  InvoiceNo: string;
  Reason: string;
  Comment?: string;
  EncryptType: number;
  CheckMacValue?: string;
}

export interface AllowanceItem {
  itemName: string;
  itemCount: number;
  itemPrice: number;
  itemAmount: number;
}

export interface CreateAllowancePayload {
  MerchantID: string;
  InvoiceNo: string;
  AllowanceNotifyURL: string;
  Items: AllowanceItem[];
  AllowanceAmount: number;
  Comment?: string;
  EncryptType: number;
  CheckMacValue?: string;
}

// ============================================
// Encryption & Security Functions
// ============================================

/**
 * 使用 AES-256-CBC 加密資料
 * ECPay 規範：使用 hashKey 和 hashIV 作為金鑰
 */
export function encryptTradeInfo(
  data: string,
  hashKey: string,
  hashIV: string
): string {
  const cipher = createCipheriv(
    'aes-256-cbc',
    Buffer.from(hashKey, 'utf-8').slice(0, 32),
    Buffer.from(hashIV, 'utf-8').slice(0, 16)
  );

  let encrypted = cipher.update(data, 'utf-8', 'hex');
  encrypted += cipher.final('hex');

  return encrypted;
}

/**
 * 生成 CheckMacValue（驗証碼）
 * 使用 SHA256 進行簽名，用於驗証資料完整性
 */
export function generateCheckMacValue(
  data: string,
  hashKey: string,
  hashIV: string
): string {
  // 前綴 hashKey，後綴 hashIV
  const rawString = `HashKey=${hashKey}&${data}&HashIV=${hashIV}`;

  // 計算 SHA256
  const hmac = createHmac('sha256', '');
  return hmac.update(rawString).digest('hex').toUpperCase();
}

// ============================================
// Payload Building Functions
// ============================================

/**
 * 組裝 ECPay 開立發票 API 的 Payload
 */
export function buildInvoicePayload(
  input: BuildInvoicePayloadInput,
  merchantId: string,
  merchantTradeDate: string
): ECPayPayload {
  // 驗証必要欄位
  if (!merchantId) {
    throw new Error('ECPAY_MERCHANT_ID 未設定');
  }

  // 確定發票類型 (MIG 4.1: 07=B2C, 08=B2B)
  const invType = input.invoiceType === 'B2C' ? '07' : '08';

  // 組裝商品名稱（以 | 分隔，支援多品項）
  const itemName = input.items
    .map((item) => `${item.itemName}x${item.itemCount}`)
    .join('|');

  // 載具類型對應表
  const carrierTypeMap: Record<string, string> = {
    phone_barcode: '1',  // 手機條碼
    cert: '2',           // 自然人憑證
    member: '3',         // 會員載具
  };

  const payload: ECPayPayload = {
    MerchantID: merchantId,
    MerchantTradeNo: input.merchantOrderNo || `INV-${Date.now()}`,
    MerchantTradeDate: merchantTradeDate, // YYYY-MM-DD HH:mm:ss 格式
    TotalAmount: input.totalAmount,
    TradeDesc: '電子發票',
    ItemName: itemName,
    ReturnURL: process.env.ECPAY_RETURN_URL || 'https://example.com/callback',
    ChoosePayment: 'ALL',
    EncryptType: 1, // 1 = SHA256
    InvType: invType,
    CustomerIdentifier: input.buyerIdentifier || '0000000000',
    Print: input.print,
  };

  // B2B 額外欄位
  if (input.invoiceType === 'B2B' && input.buyerName) {
    payload.CustomerName = input.buyerName;
  }

  // 載具欄位
  if (input.carrierType && input.carrierId) {
    payload.CarrierType = carrierTypeMap[input.carrierType] || '';
    payload.CarrierId = input.carrierId;
  }

  // 捐贈欄位
  if (input.donateCode) {
    payload.Donation = 1;
    // donateCode 需要額外設定，這裡記錄到中繼資料
  }

  // 金額欄位
  payload.TaxAmount = input.taxAmount;
  payload.SaleAmount = input.saleAmount;

  return payload;
}

// ============================================
// API Functions
// ============================================

/**
 * 調用 ECPay 開立發票 API
 *
 * @param payload - 組裝好的 Payload
 * @param hashKey - ECPay HashKey
 * @param hashIV - ECPay HashIV
 * @returns 開立結果
 */
export async function issueInvoice(
  payload: ECPayPayload,
  hashKey?: string,
  hashIV?: string
): Promise<IssueInvoiceResponse> {
  const apiUrl = process.env.ECPAY_INVOICE_URL;

  // 檢查環境變數
  if (!process.env.ECPAY_MERCHANT_ID || !hashKey || !hashIV) {
    return {
      success: false,
      error: '尚未設定 ECPay 認證資訊',
      einvoiceStatus: 'failed',
    };
  }

  try {
    // 生成 CheckMacValue
    const paramString = Object.entries(payload)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const checkMacValue = generateCheckMacValue(paramString, hashKey, hashIV);

    // 發送 API 請求
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    params.append('CheckMacValue', checkMacValue);

    const response = await fetch(apiUrl || 'https://invoice-stage.ecpay.com.tw/Invoice/Issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `API 回應異常: ${response.status}`,
        einvoiceStatus: 'failed',
      };
    }

    const text = await response.text();

    // 解析回應（通常為 JSON 或表單格式）
    let result: Record<string, any> = {};
    try {
      result = JSON.parse(text);
    } catch {
      // 嘗試解析 URL 編碼格式
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        result[key] = value;
      });
    }

    // 檢查回應狀態
    if (result.RtnCode === '1' || result.RtnCode === 1) {
      return {
        success: true,
        invoiceNumber: result.InvoiceNumber,
        invoiceDate: result.InvoiceDate,
        einvoiceStatus: 'uploaded',
        rawResponse: result,
      };
    } else {
      return {
        success: false,
        error: result.RtnMsg || '發票開立失敗',
        errorCode: result.RtnCode?.toString(),
        einvoiceStatus: 'failed',
        rawResponse: result,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    return {
      success: false,
      error: `發票開立異常: ${errorMessage}`,
      einvoiceStatus: 'failed',
    };
  }
}

/**
 * 作廢發票
 *
 * @param invoiceNumber - 發票號碼
 * @param reason - 作廢原因
 * @param hashKey - ECPay HashKey
 * @param hashIV - ECPay HashIV
 * @returns 作廢結果
 */
export async function voidInvoice(
  invoiceNumber: string,
  reason: string,
  hashKey?: string,
  hashIV?: string
): Promise<IssueInvoiceResponse> {
  const merchantId = process.env.ECPAY_MERCHANT_ID;

  if (!merchantId || !hashKey || !hashIV) {
    return {
      success: false,
      error: '尚未設定 ECPay 認證資訊',
      einvoiceStatus: 'failed',
    };
  }

  try {
    const payload: VoidInvoicePayload = {
      MerchantID: merchantId,
      InvoiceNo: invoiceNumber,
      Reason: reason,
      EncryptType: 1,
    };

    // 生成 CheckMacValue
    const paramString = Object.entries(payload)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const checkMacValue = generateCheckMacValue(paramString, hashKey, hashIV);

    // 發送 API 請求
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    params.append('CheckMacValue', checkMacValue);

    const response = await fetch(
      process.env.ECPAY_INVOICE_URL_VOID || 'https://invoice-stage.ecpay.com.tw/Invoice/IssueInvalid',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `API 回應異常: ${response.status}`,
        einvoiceStatus: 'failed',
      };
    }

    const result = await response.json().catch(() => ({}));

    if (result.RtnCode === '1' || result.RtnCode === 1) {
      return {
        success: true,
        invoiceNumber,
        einvoiceStatus: 'uploaded',
        rawResponse: result,
      };
    } else {
      return {
        success: false,
        error: result.RtnMsg || '發票作廢失敗',
        errorCode: result.RtnCode?.toString(),
        einvoiceStatus: 'failed',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    return {
      success: false,
      error: `發票作廢異常: ${errorMessage}`,
      einvoiceStatus: 'failed',
    };
  }
}

/**
 * 開立折讓（退貨時使用）
 *
 * @param invoiceNumber - 原發票號碼
 * @param items - 折讓項目
 * @param amount - 折讓金額
 * @param hashKey - ECPay HashKey
 * @param hashIV - ECPay HashIV
 * @returns 折讓結果
 */
export async function createAllowance(
  invoiceNumber: string,
  items: AllowanceItem[],
  amount: number,
  hashKey?: string,
  hashIV?: string
): Promise<IssueInvoiceResponse> {
  const merchantId = process.env.ECPAY_MERCHANT_ID;

  if (!merchantId || !hashKey || !hashIV) {
    return {
      success: false,
      error: '尚未設定 ECPay 認證資訊',
      einvoiceStatus: 'failed',
    };
  }

  try {
    const payload: CreateAllowancePayload = {
      MerchantID: merchantId,
      InvoiceNo: invoiceNumber,
      AllowanceNotifyURL: process.env.ECPAY_ALLOWANCE_URL || 'https://example.com/allowance-callback',
      Items: items,
      AllowanceAmount: amount,
      EncryptType: 1,
    };

    // 生成 CheckMacValue
    const paramString = Object.entries(payload)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => {
        if (Array.isArray(v)) {
          return `${k}=${JSON.stringify(v)}`;
        }
        return `${k}=${v}`;
      })
      .join('&');

    const checkMacValue = generateCheckMacValue(paramString, hashKey, hashIV);

    // 發送 API 請求
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, String(value));
        }
      }
    });
    params.append('CheckMacValue', checkMacValue);

    const response = await fetch(
      process.env.ECPAY_INVOICE_URL_ALLOWANCE || 'https://invoice-stage.ecpay.com.tw/Invoice/Allowance',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `API 回應異常: ${response.status}`,
        einvoiceStatus: 'failed',
      };
    }

    const result = await response.json().catch(() => ({}));

    if (result.RtnCode === '1' || result.RtnCode === 1) {
      return {
        success: true,
        invoiceNumber,
        einvoiceStatus: 'uploaded',
        rawResponse: result,
      };
    } else {
      return {
        success: false,
        error: result.RtnMsg || '折讓開立失敗',
        errorCode: result.RtnCode?.toString(),
        einvoiceStatus: 'failed',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    return {
      success: false,
      error: `折讓開立異常: ${errorMessage}`,
      einvoiceStatus: 'failed',
    };
  }
}
