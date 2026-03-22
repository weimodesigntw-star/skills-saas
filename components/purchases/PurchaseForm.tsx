'use client';

import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { purchaseOrderSchema, type PurchaseOrderFormValues } from '@/lib/schemas/purchase-order';
import { createPurchaseOrder, type PurchasePrefillLine } from '@/app/actions/purchase-orders';
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
import { PurchaseItemsTable } from './PurchaseItemsTable';
import { PurchaseProductPickerDialog, type ProductForPurchase } from './PurchaseProductPickerDialog';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { getDepots } from '@/app/actions/depots';
import { getVendors } from '@/app/actions/vendors';
import { useEffect } from 'react';
import { onFormEnterFocusNext } from '@/lib/form-enter-nav';

function buildItemsFromPrefill(prefill?: PurchasePrefillLine[]): PurchaseOrderFormValues['items'] {
  if (!prefill?.length) {
    return [{ product_name: '', unit_name: '', qty: 1, unit_price: 0 }];
  }
  return prefill.map((l) => ({
    product_id: l.product_id,
    product_code: l.product_code ?? '',
    product_name: l.product_name ?? '',
    unit_name: l.unit_name || '',
    qty: l.qty,
    unit_price: l.unit_price,
    subtotal: +(l.qty * l.unit_price).toFixed(2),
  }));
}

function calcTotals(values: PurchaseOrderFormValues) {
  const subtotal = values.items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const taxType = values.tax_type ?? '稅內含';
  const taxrate = values.taxrate ?? 0.05;
  let tax_amount = 0;
  let total = subtotal;
  if (taxType === '稅內含') {
    tax_amount = +(subtotal * (taxrate / (1 + taxrate))).toFixed(2);
    total = subtotal;
  } else if (taxType === '稅外加') {
    tax_amount = +(subtotal * taxrate).toFixed(2);
    total = +(subtotal + tax_amount).toFixed(2);
  }
  return { subtotal, tax_amount, total };
}

interface PurchaseFormProps {
  codePreview: string;
  /** INT-004：由庫存頁或 URL 帶入的預填明細 */
  prefillLines?: PurchasePrefillLine[];
}

export function PurchaseForm({ codePreview, prefillLines }: PurchaseFormProps) {
  const router = useRouter();
  const [pickerRowIndex, setPickerRowIndex] = useState<number | null>(null);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [depots, setDepots] = useState<{ id: string; depot_code: string; depot_name: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; vendor_code: string; vendor_name: string }[]>([]);

  /** 首屏即帶入預填（父層請加 key 使 query 變更時 remount，否則 RHF 不會重讀 defaultValues） */
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      vendor_id: '',
      receive_day: new Date().toISOString().slice(0, 10),
      depot_id: '',
      tax_type: '稅內含',
      taxrate: 0.05,
      note: '',
      items: buildItemsFromPrefill(prefillLines),
    },
  });

  useEffect(() => {
    getDepots().then(setDepots);
    getVendors().then(setVendors);
  }, []);

  const items = form.watch('items');
  const taxType = form.watch('tax_type');
  const taxrate = form.watch('taxrate');
  const currentValues: PurchaseOrderFormValues = {
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

  const handleProductSelect = (product: ProductForPurchase) => {
    if (pickerRowIndex == null) return;
    form.setValue(`items.${pickerRowIndex}.product_id`, product.id);
    form.setValue(`items.${pickerRowIndex}.product_code`, product.product_code ?? '');
    form.setValue(`items.${pickerRowIndex}.product_name`, product.name);
    form.setValue(`items.${pickerRowIndex}.unit_price`, product.unit_price);
    setPickerRowIndex(null);
  };

  const onSubmit = async (values: PurchaseOrderFormValues) => {
    const result = await createPurchaseOrder(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('採購單已建立');
    router.push(`/dashboard/purchases/${result.purchaseId}`);
    router.refresh();
  };

  return (
    <FormProvider {...form}>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          onKeyDown={onFormEnterFocusNext}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FormLabel>採購單號</FormLabel>
              <Input value={codePreview} readOnly className="bg-muted" />
            </div>
            <FormField
              control={form.control}
              name="receive_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>進貨日期</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>廠商</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">請選擇</option>
                      {vendors.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.vendor_name}（{v.vendor_code}）
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="depot_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>倉庫</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value)}
                    >
                      <option value="">請選擇</option>
                      {depots.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.depot_name}（{d.depot_code}）
                        </option>
                      ))}
                    </select>
                  </FormControl>
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
                      onChange={(e) => field.onChange(e.target.value === '' ? 0.05 : Number(e.target.value))}
                    />
                  </FormControl>
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
              </FormItem>
            )}
          />

          <PurchaseItemsTable onOpenProductPicker={handleOpenProductPicker} />

          <div className="border-t pt-4 space-y-1 text-sm text-right">
            <p>小計：{formatNTD(subtotal)}</p>
            <p>稅額：{formatNTD(tax_amount)}</p>
            <p className="font-bold">合計：{formatNTD(total)}</p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              取消
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? '處理中...' : '確認進貨'}
            </Button>
          </div>
        </form>
      </Form>

      <PurchaseProductPickerDialog
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onSelect={handleProductSelect}
      />
    </FormProvider>
  );
}
