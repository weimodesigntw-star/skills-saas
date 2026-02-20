/**
 * POS Store
 *
 * 使用 Zustand 管理 POS 模組的狀態
 */

import { create } from 'zustand';
import { calcTaxIncluded } from '@/lib/constants';
import type { CartItem, Product } from '@/lib/types/pos';

interface PosState {
  cart: CartItem[];
  isScannerOpen: boolean;
  isCheckoutOpen: boolean;
  selectedCategory: string | null;
  searchQuery: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  invoiceType: 'B2C' | 'B2B';
  buyerIdentifier: string;
  carrierType: string | null;
  carrierId: string | null;
  donateCode: string | null;
  isProcessing: boolean;
  addToCart: (product: Product, qty?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  setScannerOpen: (open: boolean) => void;
  setCheckoutOpen: (open: boolean) => void;
  selectCategory: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setInvoiceInfo: (info: Partial<{ invoiceType: 'B2C' | 'B2B'; buyerIdentifier: string; carrierType: string | null; carrierId: string | null; donateCode: string | null }>) => void;
  setProcessing: (v: boolean) => void;
  reset: () => void;
}

export const usePosStore = create<PosState>((set) => ({
  cart: [],
  isScannerOpen: false,
  isCheckoutOpen: false,
  selectedCategory: null,
  searchQuery: '',
  subtotal: 0,
  taxAmount: 0,
  discountAmount: 0,
  totalAmount: 0,
  invoiceType: 'B2C',
  buyerIdentifier: '',
  carrierType: null,
  carrierId: null,
  donateCode: null,
  isProcessing: false,
  addToCart: (product, qty = 1) => set((s) => {
    const existing = s.cart.find((i) => i.productId === product.id);
    const next = existing
      ? s.cart.map((i) => i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i)
      : [...s.cart, { productId: product.id, name: product.name, unitPrice: product.price, quantity: qty, barcode: product.barcode ?? undefined, imageUrl: product.image_url ?? undefined }];
    const st = next.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const tax = Math.round(calcTaxIncluded(st));
    return { cart: next, subtotal: st - tax, taxAmount: tax, totalAmount: st };
  }),
  removeFromCart: (productId) => set((s) => {
    const next = s.cart.filter((i) => i.productId !== productId);
    const st = next.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const tax = Math.round(calcTaxIncluded(st));
    return { cart: next, subtotal: st - tax, taxAmount: tax, totalAmount: st };
  }),
  updateQuantity: (productId, quantity) => set((s) => {
    if (quantity <= 0) return { cart: s.cart.filter((i) => i.productId !== productId) };
    const next = s.cart.map((i) => i.productId === productId ? { ...i, quantity } : i);
    const st = next.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    const tax = Math.round(calcTaxIncluded(st));
    return { cart: next, subtotal: st - tax, taxAmount: tax, totalAmount: st };
  }),
  setScannerOpen: (open) => set({ isScannerOpen: open }),
  setCheckoutOpen: (open) => set({ isCheckoutOpen: open }),
  selectCategory: (id) => set({ selectedCategory: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setInvoiceInfo: (info) => set((s) => ({ ...s, ...info })),
  setProcessing: (v) => set({ isProcessing: v }),
  reset: () => set({ cart: [], subtotal: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0, isCheckoutOpen: false }),
}));