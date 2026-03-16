'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PurchaseOrderFormValues } from '@/lib/schemas/purchase-order';
import { Plus, Trash2, Package } from 'lucide-react';
import { formatNTD } from '@/lib/constants';

export function PurchaseItemsTable({ onOpenProductPicker }: { onOpenProductPicker: (rowIndex: number) => void }) {
  const form = useFormContext<PurchaseOrderFormValues>();
  const { control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = form.watch('items') ?? [];

  const defaultRow = {
    product_name: '',
    unit_name: '',
    qty: 1,
    unit_price: 0,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">明細</span>
        <Button type="button" variant="outline" size="sm" onClick={() => append(defaultRow)}>
          <Plus className="h-4 w-4 mr-1" />
          新增明細
        </Button>
      </div>
      <div className="rounded border overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-2 px-2 w-8">#</th>
              <th className="text-left py-2 px-2">品名</th>
              <th className="text-left py-2 px-2 w-20">單位</th>
              <th className="text-right py-2 px-2 w-20">數量</th>
              <th className="text-right py-2 px-2 w-24">單價</th>
              <th className="text-right py-2 px-2 w-24">小計</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const row = items[index];
              const subtotal = (Number(row?.qty) ?? 0) * (Number(row?.unit_price) ?? 0);
              return (
                <tr key={field.id} className="border-t">
                  <td className="py-1 px-2 text-muted-foreground">{index + 1}</td>
                  <td className="py-1 px-2">
                    <div className="flex gap-1">
                      <Input
                        className="h-8 min-w-[120px]"
                        {...form.register(`items.${index}.product_name`)}
                        placeholder="品名"
                      />
                      <Button type="button" variant="outline" size="sm" onClick={() => onOpenProductPicker(index)} title="選品">
                        <Package className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="py-1 px-2">
                    <Input className="h-8 w-20" {...form.register(`items.${index}.unit_name`)} placeholder="件" />
                  </td>
                  <td className="py-1 px-2">
                    <Input type="number" step="0.01" min="0.01" className="h-8 text-right" {...form.register(`items.${index}.qty`)} />
                  </td>
                  <td className="py-1 px-2">
                    <Input type="number" step="0.01" min="0" className="h-8 text-right" {...form.register(`items.${index}.unit_price`)} />
                  </td>
                  <td className="py-1 px-2 text-right font-medium">{formatNTD(subtotal)}</td>
                  <td className="py-1 px-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
