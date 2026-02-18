/**
 * POS 模組相關的類型定義
 */

export interface CartItem {
  productId: string;
  name: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

export interface InvoiceInfo {
  invoiceType: 'B2C' | 'B2B';
  buyerIdentifier: string;        // 統編或0000000000
  carrierType: string | null;     // phone_barcode / cert / member
  carrierId: string | null;       // 載具編號
  donateCode: string | null;      // 愛心碼
}

export interface Product {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  barcode: string | null;
  sku: string | null;
  price: number;                  // 含稅售價
  cost: number | null;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
  is_active: boolean;
  tax_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: 'pending' | 'paid' | 'refunded' | 'voided';
  payment_method: string;
  payment_reference: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_barcode: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
