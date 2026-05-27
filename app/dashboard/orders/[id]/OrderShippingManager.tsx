'use client';

import { formatNTD } from '@/lib/constants';

import { useMemo } from 'react';

type Item = {
  id: string;
  product_name: string;
  unit_name: string | null;
  qty: number;
  shipped_qty: number;
  unit_price: number;
};

export function OrderShippingManager(props: {
  initialStatus: string;
  items: Item[];
}) {
  const { items } = props;

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

  const statusLabel: Record<string, { label: string; color: string }> = {
    pending: { label: '待出貨', color: 'bg-amber-100 text-amber-800' },
    partial: { label: '部分出貨', color: 'bg-blue-100 text-blue-800' },
    shipped: { label: '已出貨', color: 'bg-green-100 text-green-800' },
    cancelled: { label: '已取消', color: 'bg-muted text-muted-foreground' },
  };
  const normalizedStatus = props.initialStatus;
  const s = statusLabel[props.initialStatus] ?? statusLabel[normalizedStatus] ?? { label: props.initialStatus, color: 'bg-muted text-muted-foreground' };

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
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const remaining = 'remaining' in r ? Number((r as any).remaining) || 0 : 0;
              return (
                <tr key={r.id} className="border-b">
                  <td className="py-2">{r.product_name}</td>
                  <td className="py-2 text-muted-foreground">{r.unit_name ?? '—'}</td>
                  <td className="py-2 text-right">{Number(r.qty)}</td>
                  <td className="py-2 text-right">{Number(r.shipped_qty)}</td>
                  <td className="py-2 text-right">
                    {mode === 'unshipped' ? remaining : formatNTD(Number(r.unit_price))}
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
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm text-muted-foreground">狀態</span>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.color}`}>
          {s.label}
        </span>
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
          <div className="text-sm font-medium mb-2">明細</div>
          {renderRows(computed.rows as any, 'all')}
        </div>
      )}
    </div>
  );
}
