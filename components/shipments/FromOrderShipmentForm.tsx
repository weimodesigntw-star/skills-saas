'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getDepots } from '@/app/actions/depots';
import { createShipmentFromOrder } from '@/app/actions/shipments';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';

type OrderItem = {
  id: string;
  product_id: string | null;
  product_code: string | null;
  product_name: string;
  unit_name: string | null;
  qty: number;
  shipped_qty: number;
  unit_price: number;
  subtotal?: number;
};

type Order = {
  id: string;
  order_code: string;
  taxrate: number;
  tax_type: string;
  items: OrderItem[];
};

interface FromOrderShipmentFormProps {
  order: Order;
}

export function FromOrderShipmentForm({ order }: FromOrderShipmentFormProps) {
  const router = useRouter();
  const [depots, setDepots] = useState<{ id: string; depot_code: string; depot_name: string }[]>([]);
  const [shipDate, setShipDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [depotId, setDepotId] = useState('');
  const [note, setNote] = useState('');
  const [qtyByItemId, setQtyByItemId] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const items = order.items ?? [];

  useEffect(() => {
    getDepots().then(setDepots);
  }, []);

  useEffect(() => {
    const next: Record<string, number> = {};
    items.forEach((item) => {
      const remain = Math.max(0, Number(item.qty) - (Number(item.shipped_qty) ?? 0));
      next[item.id] = remain;
    });
    setQtyByItemId(next);
  }, [order.id]);

  const setItemQty = (itemId: string, qty: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const remain = Math.max(0, Number(item.qty) - (Number(item.shipped_qty) ?? 0));
    const clamped = Math.min(Math.max(0, qty), remain);
    setQtyByItemId((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const subtotal = items.reduce((s, item) => {
    const q = qtyByItemId[item.id] ?? 0;
    return s + q * Number(item.unit_price);
  }, 0);
  const taxrate = Number(order.taxrate) ?? 0.05;
  const tax_amount = order.tax_type === '稅內含' ? +(subtotal * (taxrate / (1 + taxrate))).toFixed(2) : 0;
  const total = subtotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const shipItems = items
      .map((item) => ({
        order_item_id: item.id,
        product_id: item.product_id ?? '',
        qty: qtyByItemId[item.id] ?? 0,
        unit_price: Number(item.unit_price),
      }))
      .filter((i) => i.qty > 0);
    if (shipItems.length === 0) {
      toast.error('請至少輸入一筆本次出貨量');
      return;
    }
    setSubmitting(true);
    const result = await createShipmentFromOrder(order.id, {
      ship_date: shipDate || undefined,
      depot_id: depotId || undefined,
      note: note.trim() || undefined,
      items: shipItems,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('出貨單已建立');
    router.push(`/dashboard/shipments/${result.shipmentId}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>來源訂單</Label>
          <p className="font-mono text-sm py-2">{order.order_code}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ship_date">出貨日期</Label>
          <Input
            id="ship_date"
            type="date"
            value={shipDate}
            onChange={(e) => setShipDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depot">倉庫</Label>
          <select
            id="depot"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            value={depotId}
            onChange={(e) => setDepotId(e.target.value)}
          >
            <option value="">請選擇</option>
            {depots.map((d) => (
              <option key={d.id} value={d.id}>
                {d.depot_name}（{d.depot_code}）
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">備註</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="選填" />
      </div>

      <div className="space-y-2">
        <Label>出貨明細</Label>
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left py-2 px-3 font-semibold">#</th>
                <th className="text-left py-2 px-3 font-semibold">品名</th>
                <th className="text-left py-2 px-3 font-semibold">單位</th>
                <th className="text-right py-2 px-3 font-semibold">訂購量</th>
                <th className="text-right py-2 px-3 font-semibold">已交量</th>
                <th className="text-right py-2 px-3 font-semibold">本次出貨量</th>
                <th className="text-right py-2 px-3 font-semibold">單價</th>
                <th className="text-right py-2 px-3 font-semibold">小計</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const remain = Math.max(0, Number(item.qty) - (Number(item.shipped_qty) ?? 0));
                const q = qtyByItemId[item.id] ?? remain;
                const rowSub = q * Number(item.unit_price);
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-2 px-3">{i + 1}</td>
                    <td className="py-2 px-3">{item.product_name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{item.unit_name ?? '—'}</td>
                    <td className="py-2 px-3 text-right">{Number(item.qty)}</td>
                    <td className="py-2 px-3 text-right">{Number(item.shipped_qty) ?? 0}</td>
                    <td className="py-2 px-3">
                      <Input
                        type="number"
                        step="1"
                        min={0}
                        max={remain}
                        className="h-8 w-24 text-right"
                        value={q}
                        onChange={(e) => setItemQty(item.id, parseFloat(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-2 px-3 text-right">{formatNTD(Number(item.unit_price))}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(rowSub)}</td>
                  </tr>
                );
              })}
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
        <Button type="submit" disabled={submitting}>
          {submitting ? '處理中...' : '確認出貨'}
        </Button>
      </div>
    </form>
  );
}
