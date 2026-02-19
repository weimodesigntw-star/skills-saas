/**
 * POS 共用工具函數
 *
 * 集中管理訂單狀態、付款方式等顯示邏輯，
 * 避免多個頁面重複宙義相同的 helper functions。
 */

/**
 * 訢單狀態 Badge 設定
 */
export const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  paid: { label: '已付款', variant: 'default' },
  pending: { label: '待付款', variant: 'secondary' },
  refunded: { label: '已退款', variant: 'destructive' },
  voided: { label: '已作廢', variant: 'outline' },
  cancelled: { label: '已取消', variant: 'outline' },
};

/**
 * 取得訂單狀態的中文標籤
 */
export function getOrderStatusLabel(status: string): string {
  return ORDER_STATUS_CONFIG[status]?.label || status;
}

/**
 * 取得訂單狀態的 Badge variant
 */
export function getOrderStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  return ORDER_STATUS_CONFIG[status]?.variant || 'outline';
}

/**
 * 付款方式中文標籤對照表
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '現金',
  credit_card: '信用卡',
  CREDIT: '信用卡',
  line_pay: 'LINE Pay',
  easy_card: '悠遊卡',
};

/**
 * 取得付款方式的中文標籤
 */
export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] || method;
}
