'use client';

import Link from 'next/link';
import { ShoppingCart, ArrowRight, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNTD, calcTaxIncluded } from '@/lib/constants';
import { useCart } from '@/lib/hooks/useCart';
import { CartItemRow } from '@/components/shop/CartItemRow';

export default function CartPage() {
  const { items, loading, totalCount, totalAmount, updateQuantity, removeItem } = useCart();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        載入中...
      </div>
    );
  }

  const taxAmount = calcTaxIncluded(totalAmount);
  const subtotal = totalAmount - taxAmount;
  const cartItems = items.map((i) => ({ ...i, id: i.id || i.product_id }));

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">購物車</h1>

      {cartItems.length === 0 ? (
        <div className="text-center py-16">
          <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="text-xl font-semibold mb-2">購物車是空的</h2>
          <p className="text-muted-foreground mb-6">快去逛逛我們的商品吧！</p>
          <Button asChild>
            <Link href="/shop">
              <Store className="h-4 w-4 mr-2" />
              前往購物
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4 md:p-6">
                {cartItems.map((item) => (
                  <CartItemRow
                    key={item.product_id}
                    item={item}
                    onQuantityChange={updateQuantity}
                    onRemove={removeItem}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>訂單摘要</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>小計 ({cartItems.length} 項商品)</span>
                  <span>{formatNTD(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>稅額 (5%)</span>
                  <span>{formatNTD(taxAmount)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>總計</span>
                  <span className="text-primary">{formatNTD(totalAmount)}</span>
                </div>
                <Button className="w-full mt-4" size="lg" asChild>
                  <Link href="/checkout">
                    前往結帳
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button variant="ghost" className="w-full" asChild>
                  <Link href="/shop">繼續購物</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
