'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCart, type CartItemWithProduct } from '@/app/actions/cart';
import { CheckoutForm } from '@/components/shop/CheckoutForm';

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCart();
        setItems(data);
      } catch {}
      setIsLoading(false);
    }
    load();
  }, []);

  if (isLoading) {
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

      <CheckoutForm cartItems={items} />
    </div>
  );
}
