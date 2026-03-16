'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { shipmentSchema, type ShipmentFormValues } from '@/lib/schemas/shipment';
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
import { getDepots } from '@/app/actions/depots';
import { createShipmentManual } from '@/app/actions/shipments';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray } from 'react-hook-form';

export function ShipmentForm() {
  const router = useRouter();
  const [depots, setDepots] = useState<{ id: string; depot_code: string; depot_name: string }[]>([]);

  const form = useForm<ShipmentFormValues>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      ship_date: new Date().toISOString().slice(0, 10),
      depot_id: '',
      note: '',
      items: [{ product_name: '', unit_name: '', qty: 1, unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });

  useEffect(() => {
    getDepots().then(setDepots);
  }, []);

  const items = form.watch('items') ?? [];
  const subtotal = items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const tax_amount = +(subtotal * 0.05 / 1.05).toFixed(2);
  const total = subtotal;

  const onSubmit = async (values: ShipmentFormValues) => {
    const result = await createShipmentManual(values);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('出貨單已建立');
    router.push(`/dashboard/shipments/${result.shipmentId}`);
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ship_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>出貨日期</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <FormLabel>明細</FormLabel>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ product_name: '', unit_name: '', qty: 1, unit_price: 0 })}
            >
              <Plus className="h-4 w-4 mr-1" />
              新增一列
            </Button>
          </div>
          <div className="rounded border overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-2 px-3 font-semibold">品名</th>
                  <th className="text-left py-2 px-3 font-semibold">單位</th>
                  <th className="text-right py-2 px-3 font-semibold">數量</th>
                  <th className="text-right py-2 px-3 font-semibold">單價</th>
                  <th className="text-right py-2 px-3 font-semibold">小計</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-t">
                    <td className="py-1 px-3">
                      <Input
                        className="h-8"
                        {...form.register(`items.${index}.product_name`)}
                        placeholder="品名"
                      />
                    </td>
                    <td className="py-1 px-3">
                      <Input className="h-8 w-20" {...form.register(`items.${index}.unit_name`)} placeholder="件" />
                    </td>
                    <td className="py-1 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="h-8 text-right"
                        {...form.register(`items.${index}.qty`)}
                      />
                    </td>
                    <td className="py-1 px-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-right"
                        {...form.register(`items.${index}.unit_price`)}
                      />
                    </td>
                    <td className="py-1 px-3 text-right font-medium">
                      {formatNTD(
                        (Number(items[index]?.qty) ?? 0) * (Number(items[index]?.unit_price) ?? 0)
                      )}
                    </td>
                    <td className="py-1 px-3">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
            {form.formState.isSubmitting ? '處理中...' : '儲存出貨單'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
