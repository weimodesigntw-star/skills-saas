'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CustomerOrderFormValues, OrderItemFormValues } from '@/lib/schemas/customer-order';
import { Plus, Trash2, Package } from 'lucide-react';
import { formatNTD } from '@/lib/constants';

type FormValues = CustomerOrderFormValues;

interface OrderItemsTableProps {
  onOpenProductPicker: (rowIndex: number) => void;
  showShippedQty?: boolean;
}

function itemSubtotal(item: OrderItemFormValues): number {
  const qty = Number(item.qty) || 0;
  const unit = Number(item.unit_price) || 0;
  const disc = Number(item.discount_pct) ?? 100;
  return +(qty * unit * (disc / 100)).toFixed(2);
}

export function OrderItemsTable({ onOpenProductPicker, showShippedQty = false }: OrderItemsTableProps) {
  const form = useFormContext<FormValues>();
  const { control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const defaultRow: OrderItemFormValues = {
    product_name: '',
    unit_name: '',
    qty: 1,
    shipped_qty: 0,
    unit_price: 0,
    discount_pct: 100,
    note: '',
    cancelled: false,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">明細</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(defaultRow)}
        >
          <Plus className="h-4 w-4 mr-1" />
          新增明細
        </Button>
      </div>
      <div className="rounded border overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-2 px-2 w-8">#</th>
              <th className="text-left py-2 px-2">品名</th>
              <th className="text-left py-2 px-2 w-20">單位</th>
              <th className="text-right py-2 px-2 w-20">數量</th>
              {showShippedQty && <th className="text-right py-2 px-2 w-20">已出</th>}
              <th className="text-right py-2 px-2 w-24">單價</th>
              <th className="text-right py-2 px-2 w-20">折數%</th>
              <th className="text-right py-2 px-2 w-24">小計</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <OrderItemRow
                key={field.id}
                index={index}
                control={control}
                watch={form.watch}
                onRemove={() => remove(index)}
                onOpenPicker={() => onOpenProductPicker(index)}
                showShippedQty={showShippedQty}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderItemRow({
  index,
  control,
  watch,
  onRemove,
  onOpenPicker,
  showShippedQty,
}: {
  index: number;
  control: ReturnType<typeof useFormContext<FormValues>>['control'];
  watch: ReturnType<typeof useFormContext<FormValues>>['watch'];
  onRemove: () => void;
  onOpenPicker: () => void;
  showShippedQty: boolean;
}) {
  const items = watch('items');
  const row = items?.[index];
  const qty = row?.qty ?? 0;
  const shippedQtyValue = Number((row as any)?.shipped_qty) || 0;
  const isOverShipped = shippedQtyValue > Number(qty);
  const unit_price = row?.unit_price ?? 0;
  const discount_pct = row?.discount_pct ?? 100;
  const subtotal = itemSubtotal({
    qty: Number(qty),
    unit_price: Number(unit_price),
    discount_pct: Number(discount_pct),
  } as OrderItemFormValues);

  return (
    <tr className="border-t">
      <td className="py-1 px-2 text-muted-foreground">{index + 1}</td>
      <td className="py-1 px-2">
        <div className="flex gap-1">
          <Input
            className="h-8 min-w-[120px]"
            {...control.register(`items.${index}.product_name`)}
            placeholder="品名"
          />
          <Button type="button" variant="outline" size="sm" onClick={onOpenPicker} title="選品">
            <Package className="h-4 w-4" />
          </Button>
        </div>
      </td>
      <td className="py-1 px-2">
        <Input
          className="h-8 w-20"
          {...control.register(`items.${index}.unit_name`)}
          placeholder="件"
        />
      </td>
      <td className="py-1 px-2">
        <Input
          type="number"
          step="1"
          min="1"
          className="h-8 text-right"
          {...control.register(`items.${index}.qty`)}
        />
      </td>
      {showShippedQty && (
        <td className="py-1 px-2">
          <Input
            type="number"
            step="1"
            min="0"
            max={Number(qty) || 0}
            className={`h-8 w-20 text-right ml-auto ${isOverShipped ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            {...control.register(`items.${index}.shipped_qty`)}
          />
        </td>
      )}
      <td className="py-1 px-2">
        <Input
          type="number"
          step="1"
          min="0"
          className="h-8 text-right"
          {...control.register(`items.${index}.unit_price`)}
        />
      </td>
      <td className="py-1 px-2">
        <Input
          type="number"
          step="1"
          min="0"
          max="100"
          className="h-8 text-right"
          {...control.register(`items.${index}.discount_pct`)}
        />
      </td>
      <td className="py-1 px-2 text-right font-medium">{formatNTD(subtotal)}</td>
      <td className="py-1 px-2">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </td>
    </tr>
  );
}
