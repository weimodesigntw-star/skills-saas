/**
 * POS 購物車區
 *
 * 顯示購物車詳情、金額計算、結帳按鈕
 * 包含購物車明細和摘要
 */

'use client';

import { usePosStore } from '@/store/usePosStore';
import { formatNTD } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { CartItem } from '@/lib/types/pos';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

function CartItemRow({ item }: { item: CartItem }) {
  const { removeFromCart, updateQuantity } = usePosStore();
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatNTD(item.unitPrice)} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => updateQuantity(item.productId, Math.max(0, item.quantity - 1))}
        >
          −
        </Button>
        <span className="w-8 text-center text-sm">{item.quantity}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
        >
          +
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => removeFromCart(item.productId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CartSection() {
  const { cart, totalAmount, setCheckoutOpen } = usePosStore();
  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <p>購物車是空的</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4 py-4">
        {cart.map((item) => (
          <CartItemRow key={item.productId} item={item} />
        ))}
        <Separator className="my-2" />
      </ScrollArea>
      <div className="border-t p-4 space-y-2">
        <div className="flex justify-between font-bold">
          <span>總計</span>
          <span>{formatNTD(totalAmount)}</span>
        </div>
        <Button className="w-full" onClick={() => setCheckoutOpen(true)}>
          結帳
        </Button>
      </div>
    </div>
  );
}
