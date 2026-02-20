/**
 * 全域常數定義
 *
 * 統一管理稅率、幣別、發票等設定
 */

// ============================================
// 稅務
// ============================================

/** 台灣營業稅率 5%（內含式） */
export const TAX_RATE = 0.05;

/** 計算內含稅額：含稅金額 × 5 ÷ 105 */
export function calcTaxIncluded(amountWithTax: number): number {
  return Math.round((amountWithTax * 5) / 105);
}

/** 計算未稅金額 */
export function calcAmountBeforeTax(amountWithTax: number): number {
  return amountWithTax - calcTaxIncluded(amountWithTax);
}

// ============================================
// 幣別格式化
// ============================================

const ntdFormatter = new Intl.NumberFormat('zh-TW', {
  style: 'currency',
  currency: 'TWD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 格式化為新台幣 (e.g. NT$1,200) */
export function formatNTD(amount: number): string {
  return ntdFormatter.format(amount);
}

/** 格式化為千分位數字 (e.g. 1,200) */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-TW').format(n);
}

// ============================================
// 發票相關
// ============================================

/** 發票類型 */
export const INVOICE_TYPES = {
  B2C: 'B2C',  // 二聯式
  B2B: 'B2B',  // 三聯式
} as const;

/** 載具類型 */
export const CARRIER_TYPES = {
  PHONE_BARCODE: 'phone_barcode',   // 手機條碼
  CERTIFICATE: 'cert',               // 自然人憑證
  MEMBER: 'member',                   // 會員載具
} as const;

/** 常見愛心碼（範例） */
export const COMMON_DONATE_CODES = [
  { code: '25885', name: '陽光基金會' },
  { code: '8585', name: '家扶基金會' },
  { code: '7', name: '聯合勸募' },
];

// ============================================
// 付款方式
// ============================================

export const PAYMENT_METHODS = [
  { value: 'cash', label: '現金', icon: 'Banknote' },
  { value: 'credit_card', label: '信用卡', icon: 'CreditCard' },
  { value: 'line_pay', label: 'LINE Pay', icon: 'Smartphone' },
  { value: 'easy_card', label: '悠遊卡', icon: 'CreditCard' },
] as const;

export type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

// ============================================
// POS 設定
// ============================================

/** 低庫存警示門檻（預設） */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/** 商品搜尋 Debounce 時間 (ms) */
export const SEARCH_DEBOUNCE_MS = 300;

/** 掃碼槍輸入間隔判定閾值 (ms) */
export const BARCODE_SCANNER_INTERVAL_MS = 50;

/** 結帳成功後自動返回銷售畫面的延遲 (ms) */
export const CHECKOUT_SUCCESS_REDIRECT_MS = 5000;

// ============================================
// 訂單狀態
// ============================================

export const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
} as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: '待付款',
  paid: '已付款',
  refunded: '已退款',
  voided: '已作廢',
  cancelled: '已取消',
};

// ============================================
// 發票狀態
// ============================================

export const INVOICE_STATUS = {
  ISSUED: 'issued',
  VOIDED: 'voided',
  ALLOWANCED: 'allowanced',
} as const;

export const EINVOICE_STATUS = {
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
} as const;
