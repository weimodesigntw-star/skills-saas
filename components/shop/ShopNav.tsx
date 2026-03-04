'use client';

import Link from 'next/link';
import { ShoppingCart, Store, User, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState, useTransition } from 'react';
import { getCartCount } from '@/app/actions/cart';

interface ShopNavProps {
  isLoggedIn: boolean;
  initialCartCount?: number;
}

export function ShopNav({ isLoggedIn, initialCartCount = 0 }: ShopNavProps) {
  const [cartCount, setCartCount] = useState(initialCartCount);

  // Refresh cart count periodically
  useEffect(() => {
    if (!isLoggedIn) return;
    const refresh = async () => {
      try {
        const count = await getCartCount();
        setCartCount(count);
      } catch {}
    };
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn]);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/shop" className="flex items-center gap-2 font-bold text-lg">
          <Store className="h-5 w-5 text-primary" />
          <span>Skills Shop</span>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link href="/cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-[10px] flex items-center justify-center font-bold">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </Button>

          {/* Auth */}
          {isLoggedIn ? (
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <User className="h-5 w-5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login?redirect=/shop">
                <LogIn className="h-4 w-4 mr-1" />
                登入
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
