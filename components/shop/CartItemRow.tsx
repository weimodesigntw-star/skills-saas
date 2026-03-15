'use client';

import Image from 'next/image';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNTD } from '@/lib/constants';
import { useTransition } from 'react';
import { updateCartItem, removeFromCart } from '@/app/actions/cart';
import { toast } from '@/components/ui/toast';

interface CartItemRowProps {
  item: {
    id: string;
    product_id: string;
    quantity: number;
    name: string;
    price: number;
    stock: number;
    image_url: string | null;
  };
  onUpdate?: () => void;
  /** 若提供則使用 hook 的 callback（支援 guest cart），不呼叫 server action */
  onQuantityChange?: (productId: string, qty: number) => void | Promise<void>;
  onRemove?: (productId: string) => void | Promise<void>;
}

export function CartItemRow({ item, onUpdate, onQuantityChange, onRemove }: CartItemRowProps) {
  const [isPending, startTransition] = useTransition();

  function handleQuantity(newQty: number) {
    if (onQuantityChange !== undefined && onRemove !== undefined) {
      startTransition(async () => {
        try {
          if (newQty <= 0) await onRemove(item.product_id);
          else await onQuantityChange(item.product_id, newQty);
        } catch (err: any) {
          toast.error(err?.message || '更新失敗');
        }
      });
      return;
    }
    startTransition(async () => {
      try {
        if (newQty <= 0) {
          await removeFromCart(item.product_id);
        } else {
          await updateCartItem(item.product_id, newQty);
        }
        onUpdate?.();
      } catch (err: any) {
        toast.error(err.message || '更新失敗');
      }
    });
  }

  function handleRemove() {
    if (onRemove !== undefined) {
      startTransition(async () => {
        try {
          await onRemove(item.product_id);
        } catch (err: any) {
          toast.error(err?.message || '移除失敗');
        }
      });
      return;
    }
    startTransition(async () => {
      try {
        await removeFromCart(item.product_id);
        onUpdate?.();
      } catch (err: any) {
        toast.error(err.message || '移除失敗');
      }
    });
  }

  const subtotal = item.price * item.quantity;

  return (
    <div className="flex items-center gap-4 py-4 border-b last:border-0">
      {/* Product Image */}
      <div className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden shrink-0">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            📦
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{item.name}</h4>
        <p className="text-sm text-muted-foreground">{formatNTD(item.price)}</p>
      </div>

      {/* Quantity Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleQuantity(item.quantity - 1)}
          disabled={isPending}
        >
          −
        </Button>
        <span className="w-10 text-center text-sm font-medium">
          {item.quantity}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleQuantity(item.quantity + 1)}
          disabled={isPending || item.quantity >= item.stock}
        >
          +
        </Button>
      </div>

      {/* Subtotal */}
      <div className="w-24 text-right">
        <p className="font-semibold text-sm">{formatNTD(subtotal)}</p>
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
        onClick={handleRemove}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
