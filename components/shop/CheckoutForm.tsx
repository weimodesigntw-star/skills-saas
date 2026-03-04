'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, CreditCard, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNTD, calcTaxIncluded, PAYMENT_METHODS } from '@/lib/constants';
import { createOrderFromCart, type CartItemWithProduct } from '@/app/actions/cart';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface CheckoutFormProps {
  cartItems: CartItemWithProduct[];
}

const iconMap: Record<string, React.ElementType> = {
  Banknote,
  CreditCard,
  Smartphone,
};

export function CheckoutForm({ cartItems }: CheckoutFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('');
  const [orderResult, setOrderResult] = useState<{ orderId: string; orderNumber: string } | null>(null);

  const totalAmount = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const taxAmount = calcTaxIncluded(totalAmount);
  const subtotal = totalAmount - taxAmount;

  async function handleCheckout() {
    if (!selectedPayment) {
      toast.error('請選擇付款方式');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Starting checkout with payment:', selectedPayment);
      const result = await createOrderFromCart(selectedPayment);
      console.log('Order created:', result);
      setOrderResult(result);
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err.message || '結帳失敗');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Success state
  if (orderResult) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold">訂單建立成功！</h2>
          <p className="text-muted-foreground">
            訂單編號：<span className="font-mono font-bold text-foreground">{orderResult.orderNumber}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            感謝您的購買，我們會盡快為您處理訂單。
          </p>
          <div className="flex gap-3 justify-center pt-4">
            <Button variant="outline" onClick={() => router.push('/shop')}>
              繼續購物
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Payment Method */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>選擇付款方式</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => {
                const Icon = iconMap[method.icon] || CreditCard;
                return (
                  <button
                    key={method.value}
                    onClick={() => setSelectedPayment(method.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                      selectedPayment === method.value
                        ? 'border-primary bg-primary/10'
                        : 'border-input hover:border-primary'
                    )}
                  >
                    <Icon className="h-8 w-8" />
                    <span className="text-sm font-medium">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle>訂單明細</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span className="font-medium">{formatNTD(item.price * item.quantity)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Right: Summary */}
      <div>
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle>訂單摘要</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span>小計</span>
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
            <Button
              className="w-full mt-4"
              size="lg"
              onClick={handleCheckout}
              disabled={isSubmitting || !selectedPayment}
            >
              {isSubmitting ? '處理中...' : '確認下單'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
