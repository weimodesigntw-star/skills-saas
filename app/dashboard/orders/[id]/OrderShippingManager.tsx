'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from '@/components/ui/toast';
import { updateCustomerOrderItemShippedQty, updateCustomerOrderStatus } from '@/app/actions/customer-orders';
import { Input } from '@/components/ui/input';

type Item = {
  id: string;
  product_name: string;
  unit_name: string | null;
  qty: number;
  shipped_qty: number;
  unit_price: number;
};

export function OrderShippingManager(props: {
  orderId: string;
  initialStatus: string;
  items: Item[];
}) {
  const { orderId, items } = props;
  const [status, setStatus] = useState(props.initialStatus);
  const [updatingStatus, startStatusTransition] = useTransition();
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const computed = useMemo(() => {
    const rows = items.map((it) => {
      const qty = Number(it.qty) || 0;
      const shipped = Number(it.shipped_qty) || 0;
      const remaining = Math.max(0, qty - shipped);
      return { ...it, qty, shipped_qty: shipped, remaining };
    });
    const shippedRows = rows.filter((r) => r.shipped_qty > 0);
    const unshippedRows = rows.filter((r) => r.remaining > 0);
    return { rows, shippedRows, unshippedRows };
  }, [items]);

  const normalizedStatus = status === 'paid' ? 'shipped' : status === 'unpaid' ? 'pending' : status;

  function statusLabel(s: string) {
    return s === 'pending'
      ? '待出貨'
      : s === 'partial'
        ? '部分出貨'
        : s === 'shipped'
          ? '已出貨'
          : s === 'cancelled'
            ? '已取消'
            : s;
  }

  async function onChangeStatus(next: string) {
    startStatusTransition(async () => {
      const res = await updateCustomerOrderStatus(orderId, next);
      if ((res as any)?.error) {
        toast.error((res as any).error);
        return;
      }
      setStatus(next);
      toast.success('狀態已更新');
    });
  }

  async function onSaveItem(itemId: string, shippedQty: number) {
    setUpdatingItemId(itemId);
    const res = await updateCustomerOrderItemShippedQty(itemId, shippedQty);
    setUpdatingItemId(null);
    if ((res as any)?.error) {
      toast.error((res as any).error);
      return;
    }
    toast.success('已出貨數量已更新');
  }

  const renderRows = (rows: Array<Item & { remaining?: number }>, mode: 'all' | 'shipped' | 'unshipped') => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">品名</th>
              <th className="text-left py-2 font-semibold">單位</th>
              <th className="text-right py-2 font-semibold">訂購</th>
              <th className="text-right py-2 font-semibold">已出</th>
              <th className="text-right py-2 font-semibold">{mode === 'unshipped' ? '待出' : '單價'}</th>
              <th className="text-right py-2 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const remaining = 'remaining' in r ? Number((r as any).remaining) || 0 : 0;
              const disabled = updatingItemId === r.id;
              return (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.product_name}</td>
                  <td className="py-2 text-muted-foreground">{r.unit_name ?? '—'}</td>
                  <td className="py-2 text-right">{Number(r.qty)}</td>
                  <td className="py-2 text-right">
                    <Input
                      type="number"
                      min={0}
                      max={Number(r.qty)}
                      defaultValue={Number(r.shipped_qty)}
                      disabled={disabled}
                      data-item-id={r.id}
                      className="h-8 w-20 ml-auto text-right"
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v)) return;
                        onSaveItem(r.id, v);
                      }}
                    />
                  </td>
                  <td className="py-2 text-right">
                    {mode === 'unshipped' ? remaining : Number(r.unit_price).toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    <span className="text-xs text-muted-foreground">{disabled ? '更新中…' : ''}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">狀態</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={normalizedStatus}
          disabled={updatingStatus}
          onChange={(e) => onChangeStatus(e.target.value)}
        >
          <option value="pending">待出貨</option>
          <option value="partial">部分出貨</option>
          <option value="shipped">已出貨</option>
          <option value="cancelled">已取消</option>
        </select>
        <span className="text-sm text-muted-foreground">{statusLabel(normalizedStatus)}</span>
      </div>

      {normalizedStatus === 'partial' ? (
        <div className="space-y-6">
          <div>
            <div className="text-sm font-medium mb-2">✅ 已出貨</div>
            {computed.shippedRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">尚無已出貨明細</div>
            ) : (
              renderRows(computed.shippedRows as any, 'shipped')
            )}
          </div>
          <div>
            <div className="text-sm font-medium mb-2">⏳ 未出貨</div>
            {computed.unshippedRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">沒有待出貨明細</div>
            ) : (
              renderRows(computed.unshippedRows as any, 'unshipped')
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="text-sm font-medium mb-2">明細（可直接編輯已出貨數量）</div>
          {renderRows(computed.rows as any, 'all')}
        </div>
      )}
    </div>
  );
}

