'use client';

/**
 * Receipt Preview Component
 */

import type { CartItem } from '@/lib/types/pos';
import { formatNTD } from '@/lib/constants';
import { Button } from '@/components/ui/button';

interface ReceiptPreviewProps {
  orderId: string;
  orderNumber: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  change?: number;
  onClose: () => void;
}

export function ReceiptPreview({ orderNumber, items, total, paymentMethod, change, onClose }: ReceiptPreviewProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-bold">訂單 #{orderNumber}</h3>
      <ul className="text-sm">
        {items.map((i) => (
          <li key={i.productId}>{i.name} × {i.quantity} = {formatNTD(i.unitPrice * i.quantity)}</li>
        ))}
      </ul>
      <p className="font-bold">總計 {formatNTD(total)}</p>
      <p className="text-muted-foreground">付款方式: {paymentMethod}</p>
      {change != null && <p>找零: {formatNTD(change)}</p>}
      <Button onClick={onClose}>完成</Button>
    </div>
  );
}

