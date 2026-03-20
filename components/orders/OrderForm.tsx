'use client';

import { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerOrderSchema, type CustomerOrderFormValues } from '@/lib/schemas/customer-order';
import {
  createCustomerOrder,
  updateCustomerOrder,
} from '@/app/actions/customer-orders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { OrderItemsTable } from './OrderItemsTable';
import { ProductPickerDialog, type ProductForOrder } from './ProductPickerDialog';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { fetchMembers } from '@/app/actions/customer-members';
import { MemberCombobox } from '@/components/ui/member-combobox';

function calcItemSubtotal(item: {
  qty: number;
  unit_price: number;
  discount_pct: number;
}) {
  return +(item.qty * item.unit_price * (item.discount_pct / 100)).toFixed(2);
}

function calcTotals(values: CustomerOrderFormValues) {
  const subtotal = +values.items
    .filter((i) => !i.cancelled)
    .reduce((s, i) => s + calcItemSubtotal(i), 0)
    .toFixed(2);
  let tax_amount = 0;
  let total = subtotal;
  if (values.tax_type === '稅內含') {
    tax_amount = +(subtotal * (values.taxrate / (1 + values.taxrate))).toFixed(2);
    total = subtotal;
  } else if (values.tax_type === '稅外加') {
    tax_amount = +(subtotal * values.taxrate).toFixed(2);
    total = +(subtotal + tax_amount).toFixed(2);
  }
  return { subtotal, tax_amount, total };
}

interface OrderFormProps {
  mode: 'new' | 'edit';
  orderId?: string;
  initialOrderCode?: string;
  defaultValues: Partial<CustomerOrderFormValues>;
}

export function OrderForm({
  mode,
  orderId,
  initialOrderCode,
  defaultValues,
}: OrderFormProps) {
  const router = useRouter();
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; client_code: string | null }[]>([]);

  const form = useForm<CustomerOrderFormValues>({
    resolver: zodResolver(customerOrderSchema),
    defaultValues: {
      order_code: '',
      advance_date: '',
      undertaker: '',
      member_id: '',
      currency: '台幣',
      tax_type: '稅內含',
      taxrate: 0.05,
      status: 'pending',
      sales_channel: '零售',
      note: '',
      items: [{ product_name: '', unit_name: '', qty: 1, unit_price: 0, discount_pct: 100, cancelled: false }],
      ...defaultValues,
    },
  });

  const items = form.watch('items');
  const salesChannel = form.watch('sales_channel');
  const taxType = form.watch('tax_type');
  const taxrate = form.watch('taxrate');
  const status = form.watch('status');

  useEffect(() => {
    fetchMembers({ pageSize: 500 }).then((r) => {
      setMembers((r.members ?? []) as { id: string; name: string; client_code: string | null }[]);
    });
  }, []);

  // 即時連動：items 的 shipped_qty 變化 → 自動更新 status
  useEffect(() => {
    const rows = items ?? [];
    const validRows = rows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !r?.cancelled);

    if (validRows.length === 0) return;

    let totalQty = 0;
    let totalShipped = 0;

    // 防呆：如果任一 shipped_qty 超過 qty，clamp 回 qty
    for (const { r, idx } of validRows) {
      const q = Number(r?.qty) || 0;
      const s = Number((r as any)?.shipped_qty) || 0;
      const clamped = Math.max(0, Math.min(s, q));

      totalQty += q;
      totalShipped += clamped;

      if (s !== clamped) {
        form.setValue(`items.${idx}.shipped_qty`, clamped, { shouldDirty: true, shouldTouch: true });
      }
    }

    const currentStatus = form.getValues('status');
    if (currentStatus === 'cancelled') return;

    const next =
      totalShipped === 0 ? 'pending' : totalShipped >= totalQty ? 'shipped' : 'partial';

    if (currentStatus !== next) {
      form.setValue('status', next, { shouldDirty: true, shouldTouch: true });
    }
  }, [items, status, form]);
  const currentValues: CustomerOrderFormValues = {
    ...form.getValues(),
    items: items ?? [],
    tax_type: taxType,
    taxrate: taxrate ?? 0.05,
  };
  const { subtotal, tax_amount, total } = calcTotals(currentValues);

  const handleOpenProductPicker = (rowIndex: number) => {
    setPickerRowIndex(rowIndex);
    setProductPickerOpen(true);
  };

  const handleProductSelect = (product: ProductForOrder) => {
    if (pickerRowIndex == null) return;
    form.setValue(`items.${pickerRowIndex}.product_id`, product.id);
    form.setValue(`items.${pickerRowIndex}.product_code`, product.product_code ?? '');
    form.setValue(`items.${pickerRowIndex}.product_name`, product.name);
    form.setValue(`items.${pickerRowIndex}.unit_price`, product.price);
    setPickerRowIndex(null);
  };

  const onSubmit = async (values: CustomerOrderFormValues) => {
    if (mode === 'new') {
      const result = await createCustomerOrder(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('訂單已建立');
      router.push(`/dashboard/orders/${result.orderId}`);
      router.refresh();
    } else if (orderId) {
      const result = await updateCustomerOrder(orderId, values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success('訂單已更新');
      router.push(`/dashboard/orders/${orderId}`);
      router.refresh();
    }
  };

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="order_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>訂單號碼</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-muted" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="advance_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>預交日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="member_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>客戶</FormLabel>
                  <FormControl>
                    <MemberCombobox
                      members={members}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="搜尋客戶"
                      allLabel="無會員"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="undertaker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>承辦人</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="承辦人" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>幣別</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="台幣">台幣</option>
                      <option value="美元">美元</option>
                      <option value="日幣">日幣</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tax_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>稅別</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="稅內含">稅內含</option>
                      <option value="稅外加">稅外加</option>
                      <option value="免稅">免稅</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="taxrate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>稅率</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={1}
                      value={field.value ?? 0.05}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === '' ? 0.05 : Number(e.target.value)
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>出貨狀態</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="pending">待出貨</option>
                      <option value="partial">部分出貨</option>
                      <option value="shipped">已出貨</option>
                      <option value="cancelled">已取消</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sales_channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>銷售方式</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="零售">零售</option>
                      <option value="批發">批發</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>備註</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={2} placeholder="選填" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <OrderItemsTable
            onOpenProductPicker={handleOpenProductPicker}
            showShippedQty={status !== 'cancelled'}
          />

          <div className="border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-end gap-4">
              <span>小計：{formatNTD(subtotal)}</span>
            </div>
            <div className="flex justify-end gap-4">
              <span>稅額：{formatNTD(tax_amount)}</span>
            </div>
            <div className="flex justify-end gap-4 font-bold">
              <span>合計：{formatNTD(total)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '處理中...' : '儲存訂單'}
            </Button>
          </div>
        </form>
      </Form>

      <ProductPickerDialog
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onSelect={handleProductSelect}
        salesChannel={salesChannel}
      />
    </FormProvider>
  );
}
