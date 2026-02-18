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

  const lineSubtotal = item.unitPrice * item.quantity;

  return (
    <div className="px-3 py-2 border-b text-sm space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium flex-1 truncate">{item.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => removeFromCart(item.productId)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatNTD(item.unitPrice)}</span>
        <span>{formatNTD(lineSubtotal)}</span>
      </div>

      {/* 數量調整 */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
        >
          −
        </Button>
        <input
          type="number"
          min="1"
          value={item.quantity}
          onChange={(e) => {
            const qty = parseInt(e.target.value) || 0;
            if (qty > 0) {
              updateQuantity(item.productId, qty);
            }
          }}
          className="w-12 text-center border rounded px-1 py-0.5 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
        >
          +
        </Button>
      </div>
    </div>
  );
}

export function CartSection() {
  const {
    cart,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    setDiscount,
    setCheckoutOpen,
    clearCart,
  } = usePosStore();

  const isEmpty = cart.length === 0;

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* 購物車標題 */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h2 className="font-semibold text-foreground">購物車</h2>
        {!isEmpty && (
          <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-1">
            {cart.length} 項
          </span>
        )}
      </div>

      {isEmpty ? (
        // 空購物車狀態
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-sm font-medium">購物車是空的</p>
            <p className="text-xs mt-1">點擊商品以新增</p>
          </div>
        </div>
      ) : (
        <>
          {/* 購物車清單 */}
          <ScrollArea className="flex-1">
            {cart.map((item) => (
              <CartItemRow key={item.productId} item={item} />
            ))}
          </ScrollArea>

          <Separator />

          {/* 金額摘要 */}
          <div className="px-4 py-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">小計</span>
              <span>{formatNTD(subtotal)}</span>
            </div>

            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">稅額（含稅）</span>
              <span>{formatNTD(taxAmount)}</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">折扣</span>
                <span className="text-destructive">-{formatNTD(discountAmount)}</span>
              </div>
            )}

            <Separator className="my-2" />

            <div className="flex justify-between font-bold text-base">
              <span>總計</span>
              <span className="text-primary">{formatNTD(totalAmount)}</span>
            </div>
          </div>

          {/* 結帳按鈕和其他操作 */}
          <div className="px-4 py-3 space-y-2 border-t">
            <Button
              onClick={() => setCheckoutOpen(true)}
              className="w-full h-16 text-lg font-bold"
              disabled={isEmpty}
            >
              結帳 {formatNTD(totalAmount)}
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const discountStr = prompt('輸入折扣金額', discountAmount.toString());
                  if (discountStr !== null) {
                    const discount = parseFloat(discountStr) || 0;
                    setDiscount(Math.max(0, discount));
                  }
                }}
              >
                折扣
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={clearCart}
                disabled={isEmpty}
                className="text-destructive"
              >
                清空
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
