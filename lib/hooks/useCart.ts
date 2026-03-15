'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getCart, mergeGuestCart, addToCart as addToCartAction, updateCartItem, removeFromCart, clearCart as clearCartAction, type CartItemWithProduct, type GuestCartItem } from '@/app/actions/cart';

const GUEST_CART_KEY = 'guest_cart';

export type CartItem = CartItemWithProduct & { selected_specs?: Record<string, string> };

function loadGuestCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(GUEST_CART_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveGuestCart(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
}

export function useCart() {
  const supabase = createClient();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadDbCart = useCallback(async () => {
    const data = await getCart();
    setItems(data || []);
  }, []);

  const loadLocalCart = useCallback(() => {
    setItems(loadGuestCart());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setIsLoggedIn(!!user);
      if (user) {
        const guestRaw = typeof window !== 'undefined' ? localStorage.getItem(GUEST_CART_KEY) : null;
        if (guestRaw) {
          try {
            const guestItems: GuestCartItem[] = JSON.parse(guestRaw);
            await mergeGuestCart(user.id, guestItems);
            if (typeof window !== 'undefined') localStorage.removeItem(GUEST_CART_KEY);
          } catch {}
        }
        await loadDbCart();
      } else {
        loadLocalCart();
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadDbCart, loadLocalCart, supabase.auth]);

  const addToCart = useCallback(
    async (product: { id: string; name: string; price: number; stock: number; image_url?: string | null }, quantity: number = 1) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await addToCartAction(product.id, quantity);
        await loadDbCart();
      } else {
        const current = loadGuestCart();
        const existing = current.find((i) => i.product_id === product.id);
        const newItems = existing
          ? current.map((i) =>
              i.product_id === product.id
                ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock || 999) }
                : i
            )
          : [
              ...current,
              {
                id: product.id,
                product_id: product.id,
                quantity,
                name: product.name,
                price: product.price,
                stock: product.stock,
                image_url: product.image_url ?? null,
              },
            ];
        saveGuestCart(newItems);
        setItems(newItems);
      }
    },
    [loadDbCart, supabase.auth]
  );

  const updateQuantity = useCallback(
    async (productId: string, quantity: number) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await updateCartItem(productId, quantity);
        await loadDbCart();
      } else {
        const current = loadGuestCart();
        if (quantity <= 0) {
          const newItems = current.filter((i) => i.product_id !== productId);
          saveGuestCart(newItems);
          setItems(newItems);
          return;
        }
        const newItems = current.map((i) =>
          i.product_id === productId ? { ...i, quantity: Math.min(quantity, i.stock || 999) } : i
        );
        saveGuestCart(newItems);
        setItems(newItems);
      }
    },
    [loadDbCart, supabase.auth]
  );

  const removeItem = useCallback(
    async (productId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await removeFromCart(productId);
        await loadDbCart();
      } else {
        const newItems = loadGuestCart().filter((i) => i.product_id !== productId);
        saveGuestCart(newItems);
        setItems(newItems);
      }
    },
    [loadDbCart, supabase.auth]
  );

  const clearCart = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await clearCartAction();
      await loadDbCart();
    } else {
      if (typeof window !== 'undefined') localStorage.removeItem(GUEST_CART_KEY);
      setItems([]);
    }
  }, [loadDbCart, supabase.auth]);

  const totalCount = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return {
    items,
    loading,
    isLoggedIn,
    totalCount,
    totalAmount,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };
}
