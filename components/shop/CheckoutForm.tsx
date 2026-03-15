'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Banknote, CreditCard, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatNTD, calcTaxIncluded, PAYMENT_METHODS } from '@/lib/constants';
import { checkoutSchema, type CheckoutFormValues } from '@/lib/schemas/checkout';
import { createOrderFromCart, type CartItemWithProduct } from '@/app/actions/cart';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface CheckoutFormProps {
  cartItems: CartItemWithProduct[];
  onSuccess?: () => void | Promise<void>;
}

const iconMap: Record<string, React.ElementType> = {
  Banknote,
  CreditCard,
  Smartphone,
};

export function CheckoutForm({ cartItems, onSuccess }: CheckoutFormProps) {
  const router = useRouter();
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    orderNumber: string;
  } | null>(null);

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      address: '',
      note: '',
      paymentMethod: undefined,
    },
  });

  const totalAmount = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const taxAmount = calcTaxIncluded(totalAmount);
  const subtotal = totalAmount - taxAmount;
  const isSubmitting = form.formState.isSubmitting;

  async function handleCheckout(values: CheckoutFormValues) {
    const result = await createOrderFromCart(values);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    await onSuccess?.();
    setOrderResult(result);
  }

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleCheckout)} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>收件資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名 *</FormLabel>
                    <FormControl>
                      <Input placeholder="王小明" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>手機號碼 *</FormLabel>
                    <FormControl>
                      <Input placeholder="0912345678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>地址 *</FormLabel>
                    <FormControl>
                      <Input placeholder="台南市東區..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>備註（選填）</FormLabel>
                    <FormControl>
                      <Textarea placeholder="配送時間、其他需求..." rows={2} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>付款方式 *</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-2 gap-3">
                      {PAYMENT_METHODS.map((method) => {
                        const Icon = iconMap[method.icon] || CreditCard;
                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => field.onChange(method.value)}
                            className={cn(
                              'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
                              field.value === method.value
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

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
                type="submit"
                className="w-full mt-4"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? '處理中...' : '確認下單'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
