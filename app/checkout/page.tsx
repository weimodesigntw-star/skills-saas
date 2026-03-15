'use client';

import Link from 'next/link';
import { ShoppingCart, ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/hooks/useCart';
import { CheckoutForm } from '@/components/shop/CheckoutForm';

export default function CheckoutPage() {
  const { items, loading, isLoggedIn, clearCart } = useCart();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        載入中...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-semibold mb-2">購物車是空的</h2>
        <p className="text-muted-foreground mb-6">請先將商品加入購物車</p>
        <Button asChild>
          <Link href="/shop">前往購物</Link>
        </Button>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md mx-auto">
        <LogIn className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
        <h2 className="text-xl font-semibold mb-2">請先登入以結帳</h2>
        <p className="text-muted-foreground mb-6">
          您目前有 {items.length} 項商品在購物車，登入後即可結帳，購物車內容會保留。
        </p>
        <Button asChild>
          <Link href="/login?redirect=/checkout">登入</Link>
        </Button>
        <Button variant="outline" className="ml-3" asChild>
          <Link href="/shop">繼續購物</Link>
        </Button>
      </div>
    );
  }

  const cartItems = items.map((i) => ({ ...i, id: i.id || i.product_id }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回購物車
      </Link>

      <h1 className="text-3xl font-bold mb-8">結帳</h1>

      <CheckoutForm cartItems={cartItems} onSuccess={clearCart} />
    </div>
  );
}
