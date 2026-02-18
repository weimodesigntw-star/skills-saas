'use client';

/**
 * Receipt Preview Component
 *
 * Displays order receipt in a receipt-style layout:
 * - Shop name header
 * - Order number and date/time
 * - Item list with qty, price, subtotal
 * - Totals section
 * - Payment method and change
 * - Print and complete buttons
 * - Auto-redirects after 10 seconds
 */

import { useEffect, useState } from 'react';
import { DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatNTD } from '@/lib/constants';
import { toast } from '@/components/ui/toast';
import { CartItem } from '@/lib/types/pos';
import { Printer, CheckCircle2 } from 'lucide-react';

interface ReceiptPreviewProps {
  orderId: string;
  orderNumber: string;
  items: CartItem[];
  total: number;
  paymentMethod: string;
  change?: number;
  onClose: () => void;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: '現金',
  credit_card: '信用卡',
  line_pay: 'LINE Pay',
  easy_card: '悠遊卡',
};

export function ReceiptPreview({
  orderId,
  orderNumber,
  items,
  total,
  paymentMethod,
  change,
  onClose,
}: ReceiptPreviewProps) {
  const [countdown, setCountdown] = useState(10);

  // Auto-close after countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onClose]);

  const handlePrint = () => {
    toast.info('列印功能開發中');
  };

  const itemsSubtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const taxAmount = Math.round((itemsSubtotal * 5) / 105);

  return (
    <div className="flex flex-col gap-4">
      {/* Receipt Container - Receipt-style layout */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-lg border font-mono text-sm space-y-3">
        {/* Header */}
        <div className="text-center space-y-1 pb-3 border-b">
          <h3 className="font-bold text-base">店鋪名稱</h3>
          <p className="text-xs text-muted-foreground">銷售收據</p>
        </div>

        {/* Order Info */}
        <div className="text-center space-y-0.5 text-xs pb-3 border-b">
          <div className="flex justify-between">
            <span>訂單號碼：</span>
            <span className="font-bold">{orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>交易時間：</span>
            <span>{new Date().toLocaleString('zh-TW')}</span>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-2 pb-3 border-b text-xs">
          {items.map((item) => {
            const lineSubtotal = item.unitPrice * item.quantity;
            return (
              <div key={item.productId}>
                <div className="flex justify-between gap-2">
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-right tabular-nums">
                    {formatNTD(lineSubtotal)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between gap-2">
                  <span>
                    {item.quantity}x {formatNTD(item.unitPrice)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="space-y-1 pb-3 border-b text-xs">
          <div className="flex justify-between">
            <span>小計</span>
            <span className="tabular-nums">{formatNTD(itemsSubtotal)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>稅額（含稅5%）</span>
            <span className="tabular-nums">{formatNTD(taxAmount)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1">
            <span>合計</span>
            <span className="tabular-nums">{formatNTD(total)}</span>
          </div>
        </div>

        {/* Payment Info */}
        <div className="space-y-1 text-xs pb-3 border-b">
          <div className="flex justify-between">
            <span>付款方式</span>
            <span>
              {PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod}
            </span>
          </div>
          {change !== undefined && (
            <div className="flex justify-between font-bold text-green-600 dark:text-green-400">
              <span>找零</span>
              <span className="tabular-nums">{formatNTD(change)}</span>
            </div>
          )}
        </div>

        {/* Invoice (Placeholder) */}
        <div className="text-center text-xs text-muted-foreground pb-3 border-b">
          <p>發票號碼：TBD</p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground space-y-1 pt-3">
          <p>感謝惠顧</p>
          <p className="text-xs">---</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-4 border-t">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex-1"
          >
            <Printer className="h-4 w-4 mr-2" />
            列印
          </Button>
          <Button
            onClick={onClose}
            className="flex-1"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            完成
          </Button>
        </div>

        {/* Auto-close Countdown */}
        <div className="text-center text-xs text-muted-foreground">
          {countdown > 0 && (
            <p>將在 {countdown} 秒後自動關閉</p>
          )}
        </div>
      </div>
    </div>
  );
}
