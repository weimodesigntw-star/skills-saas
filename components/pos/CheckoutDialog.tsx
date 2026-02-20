'use client';

/**
 * Checkout Dialog Component
 *
 * Multi-step checkout flow:
 * Step 1: Payment method selection
 * Step 2 (if cash): Enter received amount, display change
 * Step 3: Invoice information (B2C/B2B toggle, carrier selection, etc.)
 * Step 4: Confirmation and order creation
 *
 * On success: Shows receipt preview and redirects after 10 seconds
 * On error: Shows error toast and allows retry
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePosStore } from '@/store/usePosStore';
import { toast } from '@/components/ui/toast';
import { formatNTD, PAYMENT_METHODS } from '@/lib/constants';
import { createPosOrder, fetchProductByBarcode } from '@/app/actions/pos';
import { NumPad } from './NumPad';
import { ReceiptPreview } from './ReceiptPreview';
import { Banknote, CreditCard, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
}

type CheckoutStep = 'payment' | 'cash' | 'invoice' | 'receipt';

const iconMap: Record<string, React.ElementType> = {
  Banknote,
  CreditCard,
  Smartphone,
};

export function CheckoutDialog({ open, onClose }: CheckoutDialogProps) {
  const {
    cart,
    totalAmount,
    subtotal,
    taxAmount,
    discountAmount,
    invoiceType,
    buyerIdentifier,
    carrierType,
    carrierId,
    setInvoiceInfo,
    setProcessing,
    isProcessing,
    reset,
  } = usePosStore();

  const [step, setStep] = useState<CheckoutStep>('payment');
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [numpadAmount, setNumpadAmount] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Invoice state
  const [localInvoiceType, setLocalInvoiceType] = useState<'B2C' | 'B2B'>(invoiceType);
  const [localBuyerIdentifier, setLocalBuyerIdentifier] = useState(buyerIdentifier);
  const [localCarrierType, setLocalCarrierType] = useState(carrierType);
  const [localCarrierId, setLocalCarrierId] = useState(carrierId);

  const changeAmount = Math.max(
    0,
    Math.round(parseFloat(receivedAmount || '0')) - totalAmount
  );

  const handlePaymentSelect = (value: string) => {
    setSelectedPayment(value);
    if (value === 'cash') {
      setStep('cash');
      setReceivedAmount('');
      setNumpadAmount('');
    } else {
      setStep('invoice');
    }
  };

  const handleCashConfirm = () => {
    const amount = parseInt(numpadAmount, 10);
    if (amount >= totalAmount) {
      setReceivedAmount(numpadAmount);
      setStep('invoice');
    } else {
      toast.error('收取金額須大於等於總計');
    }
  };

  const handleInvoiceNext = () => {
    // Validate invoice info
    if (localInvoiceType === 'B2B') {
      if (!localBuyerIdentifier || localBuyerIdentifier.length !== 8) {
        toast.error('統編必須為8位數字');
        return;
      }
    }

    if (localCarrierType && !localCarrierId) {
      toast.error('請填寫載具號碼');
      return;
    }

    // Update store with invoice info
    setInvoiceInfo({
      invoiceType: localInvoiceType,
      buyerIdentifier: localBuyerIdentifier,
      carrierType: localCarrierType,
      carrierId: localCarrierId,
    });

    // Proceed to confirm
    handleCreateOrder();
  };

  const handleCreateOrder = async () => {
    try {
      setProcessing(true);

      const items = cart.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }));

      const orderId = await createPosOrder(
        selectedPayment,
        items,
        discountAmount
      );

      setOrderId(orderId);

      // Extract order number from response (assuming it's the ID format)
      setOrderNumber(`POS-${orderId.substring(0, 8).toUpperCase()}`);

      setStep('receipt');
    } catch (error) {
      const message = error instanceof Error ? error.message : '建立訂單失敗';
      toast.error(message);
      setProcessing(false);
    }
  };

  const handleReceiptClose = () => {
    reset();
    onClose();
  };

  if (!open) return null;

  const isEmpty = cart.length === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        {/* Payment Method Selection */}
        {step === 'payment' && (
          <>
            <DialogHeader>
              <DialogTitle>選擇付款方式</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-4">
              {PAYMENT_METHODS.map((method) => {
                const Icon = iconMap[method.icon] || CreditCard;
                return (
                  <button
                    key={method.value}
                    onClick={() => handlePaymentSelect(method.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      selectedPayment === method.value
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:border-primary'
                    )}
                  >
                    <Icon className="h-8 w-8 text-foreground" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                );
              })}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={onClose}
              >
                取消
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Cash Input */}
        {step === 'cash' && (
          <>
            <DialogHeader>
              <DialogTitle>輸入收取金額</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">應收金額</p>
                <p className="text-2xl font-bold">{formatNTD(totalAmount)}</p>
              </div>

              <NumPad
                value={numpadAmount}
                onChange={setNumpadAmount}
                onConfirm={handleCashConfirm}
              />

              {numpadAmount && parseInt(numpadAmount, 10) >= totalAmount && (
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-muted-foreground mb-1">找零</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatNTD(changeAmount)}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep('payment')}
              >
                上一步
              </Button>
              <Button
                onClick={handleCashConfirm}
                disabled={!numpadAmount || parseInt(numpadAmount, 10) < totalAmount}
              >
                確認
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Invoice Information */}
        {step === 'invoice' && (
          <>
            <DialogHeader>
              <DialogTitle>發票資訊</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Invoice Type */}
              <div className="space-y-2">
                <Label>發票類型</Label>
                <div className="grid grid-cols-2 gap-2">
                  {['B2C', 'B2B'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setLocalInvoiceType(type as 'B2C' | 'B2B')}
                      className={cn(
                        'p-2 rounded-lg border-2 transition-all text-sm font-medium',
                        localInvoiceType === type
                          ? 'border-primary bg-primary/10'
                          : 'border-input hover:border-primary'
                      )}
                    >
                      {type === 'B2C' ? '二聯式(B2C)' : '三聯式(B2B)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* B2B: Buyer Identifier */}
              {localInvoiceType === 'B2B' && (
                <div className="space-y-2">
                  <Label htmlFor="buyer-id">統編</Label>
                  <Input
                    id="buyer-id"
                    type="text"
                    placeholder="8 位統編"
                    value={localBuyerIdentifier}
                    onChange={(e) => setLocalBuyerIdentifier(e.target.value)}
                    maxLength={8}
                  />
                </div>
              )}

              {/* Carrier Type */}
              <div className="space-y-2">
                <Label htmlFor="carrier-type">載具類型</Label>
                <select
                  id="carrier-type"
                  value={localCarrierType || ''}
                  onChange={(e) =>
                    setLocalCarrierType(e.target.value || null)
                  }
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">不列印</option>
                  <option value="phone_barcode">手機條碼</option>
                  <option value="cert">自然人憑證</option>
                </select>
              </div>

              {/* Carrier ID (if carrier selected) */}
              {localCarrierType && (
                <div className="space-y-2">
                  <Label htmlFor="carrier-id">
                    {localCarrierType === 'phone_barcode'
                      ? '手機條碼號碼'
                      : '自然人憑證號碼'}
                  </Label>
                  <Input
                    id="carrier-id"
                    type="text"
                    placeholder={
                      localCarrierType === 'phone_barcode'
                        ? '/XXXXXXXX'
                        : 'XXXXXXXXXX'
                    }
                    value={localCarrierId || ''}
                    onChange={(e) => setLocalCarrierId(e.target.value)}
                  />
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>小計</span>
                  <span>{formatNTD(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>稅額</span>
                  <span>{formatNTD(taxAmount)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-destructive">
                    <span>折扣</span>
                    <span>-{formatNTD(discountAmount)}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>總計</span>
                  <span className="text-primary">{formatNTD(totalAmount)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep(selectedPayment === 'cash' ? 'cash' : 'payment')}
              >
                上一步
              </Button>
              <Button
                onClick={handleInvoiceNext}
                disabled={isProcessing}
                className="min-w-[120px]"
              >
                {isProcessing ? '處理中...' : '確認訂單'}
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Receipt Preview */}
        {step === 'receipt' && orderId && orderNumber && (
          <ReceiptPreview
            orderId={orderId}
            orderNumber={orderNumber}
            items={cart}
            total={totalAmount}
            paymentMethod={selectedPayment}
            change={selectedPayment === 'cash' ? changeAmount : undefined}
            onClose={handleReceiptClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
