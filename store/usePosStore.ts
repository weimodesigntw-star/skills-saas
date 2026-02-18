/**
 * POS Store
 *
 * 使用 Zustand 管理 POS 模組的狀態：
 * - 購物車（商品清單）
 * - 金額計算（小計、稅額、折扣、總計）
 * - 發票資訊
 * - UI 狀態（結帳、掃碼器、分類等）
 */

import { create } from 'zustand';
import { calcTaxIncluded } from '@/lib/constants';
import { CartItem, InvoiceInfo, Product } from '@/lib/types/pos';

interface PosStore {
  // ============================================
  // 購物車
  // ============================================

  cart: CartItem[];

  /**
   * 加入購物車
   * 如果商品已存在，增加數量；否則新增
   */
  addToCart: (product: Product, quantity?: number) => void;

  /**
   * 從購物車移除商品
   */
  removeFromCart: (productId: string) => void;

  /**
   * 更新購物車中商品的數量
   */
  updateQuantity: (productId: string, quantity: number) => void;

  /**
   * 清空購物車
   */
  clearCart: () => void;

  // ============================================
  // 金額計算（自動計算）
  // ============================================

  subtotal: number;       // 小計（含稅）
  taxAmount: number;      // 稅額（內含式 5%）
  discountAmount: number; // 折扣
  totalAmount: number;    // 總計

  /**
   * 設置折扣金額
   */
  setDiscount: (amount: number) => void;

  // ============================================
  // 發票資訊
  // ============================================

  invoiceType: 'B2C' | 'B2B';
  buyerIdentifier: string;        // 統編
  carrierType: string | null;     // 載具類型
  carrierId: string | null;       // 載具號碼
  donateCode: string | null;      // 愛心碼

  /**
   * 設置發票資訊
   */
  setInvoiceInfo: (info: Partial<InvoiceInfo>) => void;

  // ============================================
  // UI 狀態
  // ============================================

  isCheckoutOpen: boolean;
  isScannerOpen: boolean;
  isProcessing: boolean;
  selectedCategory: string | null;  // 'all' or category id
  searchQuery: string;

  /**
   * 打開/關閉結帳彈窗
   */
  setCheckoutOpen: (open: boolean) => void;

  /**
   * 打開/關閉掃碼器
   */
  setScannerOpen: (open: boolean) => void;

  /**
   * 設置處理中狀態
   */
  setProcessing: (processing: boolean) => void;

  /**
   * 選擇分類
   */
  selectCategory: (categoryId: string | null) => void;

  /**
   * 設置搜尋查詢
   */
  setSearchQuery: (query: string) => void;

  /**
   * 重置 Store（通常在結帳成功後調用）
   */
  reset: () => void;
}

const initialState = {
  // Cart
  cart: [] as CartItem[],

  // Amounts
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 0,

  // Invoice
  invoiceType: 'B2C' as const,
  buyerIdentifier: '0000000000',
  carrierType: null as string | null,
  carrierId: null as string | null,
  donateCode: null as string | null,

  // UI State
  isCheckoutOpen: false,
  isScannerOpen: false,
  isProcessing: false,
  selectedCategory: null as string | null,
  searchQuery: '',
};

export const usePosStore = create<PosStore>((set, get) => {
  /**
   * 重新計算金額
   */
  const recalculateAmounts = () => {
    const { cart, discountAmount } = get();

    // 計算小計
    const subtotal = cart.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);

    // 計算稅額（內含式 5%）
    const taxAmount = calcTaxIncluded(subtotal);

    // 計算總計
    const totalAmount = subtotal - discountAmount;

    return { subtotal, taxAmount, totalAmount };
  };

  return {
    ...initialState,

    // ============================================
    // 購物車操作
    // ============================================

    addToCart: (product: Product, quantity = 1) => {
      set((state) => {
        const existingItem = state.cart.find(item => item.productId === product.id);

        let newCart: CartItem[];

        if (existingItem) {
          // 商品已存在，增加數量
          newCart = state.cart.map(item =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          // 新增商品
          newCart = [
            ...state.cart,
            {
              productId: product.id,
              name: product.name,
              barcode: product.barcode || undefined,
              unitPrice: product.price,
              quantity,
              imageUrl: product.image_url || undefined,
            },
          ];
        }

        const amounts = recalculateAmounts.call({ get: () => ({ ...state, cart: newCart, discountAmount: state.discountAmount }) });

        return {
          cart: newCart,
          ...amounts,
        };
      });
    },

    removeFromCart: (productId: string) => {
      set((state) => {
        const newCart = state.cart.filter(item => item.productId !== productId);
        const amounts = recalculateAmounts.call({ get: () => ({ ...state, cart: newCart, discountAmount: state.discountAmount }) });

        return {
          cart: newCart,
          ...amounts,
        };
      });
    },

    updateQuantity: (productId: string, quantity: number) => {
      set((state) => {
        if (quantity <= 0) {
          // 數量 <= 0 時，移除商品
          return get().removeFromCart(productId) as any;
        }

        const newCart = state.cart.map(item =>
          item.productId === productId
            ? { ...item, quantity }
            : item
        );

        const amounts = recalculateAmounts.call({ get: () => ({ ...state, cart: newCart, discountAmount: state.discountAmount }) });

        return {
          cart: newCart,
          ...amounts,
        };
      });
    },

    clearCart: () => {
      set({
        cart: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
      });
    },

    // ============================================
    // 金額操作
    // ============================================

    setDiscount: (amount: number) => {
      set((state) => {
        const discountAmount = Math.max(0, amount);
        const amounts = recalculateAmounts.call({ get: () => ({ ...state, discountAmount }) });

        return {
          discountAmount,
          ...amounts,
        };
      });
    },

    // ============================================
    // 發票資訊
    // ============================================

    setInvoiceInfo: (info: Partial<InvoiceInfo>) => {
      set((state) => {
        return {
          invoiceType: info.invoiceType ?? state.invoiceType,
          buyerIdentifier: info.buyerIdentifier ?? state.buyerIdentifier,
          carrierType: info.carrierType ?? state.carrierType,
          carrierId: info.carrierId ?? state.carrierId,
          donateCode: info.donateCode ?? state.donateCode,
        };
      });
    },

    // ============================================
    // UI 狀態
    // ============================================

    setCheckoutOpen: (open: boolean) => {
      set({ isCheckoutOpen: open });
    },

    setScannerOpen: (open: boolean) => {
      set({ isScannerOpen: open });
    },

    setProcessing: (processing: boolean) => {
      set({ isProcessing: processing });
    },

    selectCategory: (categoryId: string | null) => {
      set({ selectedCategory: categoryId });
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    // ============================================
    // 重置
    // ============================================

    reset: () => {
      set(initialState);
    },
  };
});
