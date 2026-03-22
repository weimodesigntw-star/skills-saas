'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchProductSalesHistory, type ProductSalesLine } from '@/app/actions/product-insights';
import { fetchStockHistory, type StockHistoryRecord } from '@/app/actions/inventory';
import { formatNTD } from '@/lib/constants';

type TabId = 'sales' | 'stock';

export function ProductEditHistoryTabs({ productId }: { productId: string }) {
  const [tab, setTab] = useState<TabId>('sales');
  const [sales, setSales] = useState<ProductSalesLine[]>([]);
  const [stock, setStock] = useState<StockHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (tab === 'sales') {
      fetchProductSalesHistory(productId, 30).then((rows) => {
        if (!cancelled) {
          setSales(rows);
          setLoading(false);
        }
      });
    } else {
      fetchStockHistory({ productId, page: 1, pageSize: 30 }).then((r) => {
        if (!cancelled) {
          setStock(r.records);
          setLoading(false);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [productId, tab]);

  return (
    <div className="mt-8 border rounded-lg overflow-hidden">
      <div className="flex border-b bg-muted/40">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === 'sales' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          onClick={() => setTab('sales')}
        >
          銷售紀錄
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === 'stock' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          onClick={() => setTab('stock')}
        >
          庫存異動
        </button>
      </div>
      <div className="p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">載入中…</p>
        ) : tab === 'sales' ? (
          sales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">近 30 筆無客戶訂單銷售紀錄</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">訂單號</th>
                    <th className="py-2 pr-3">日期</th>
                    <th className="py-2 pr-3">客戶</th>
                    <th className="py-2 pr-3 text-right">數量</th>
                    <th className="py-2 pr-3 text-right">單價</th>
                    <th className="py-2 text-right">小計</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((r, i) => (
                    <tr key={`${r.order_code}-${i}`} className="border-b border-muted/50">
                      <td className="py-2 pr-3 font-mono text-xs">
                        <Link href={`/dashboard/orders?${new URLSearchParams({ q: r.order_code }).toString()}`} className="text-primary hover:underline">
                          {r.order_code}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.advance_date ?? '—'}</td>
                      <td className="py-2 pr-3">{r.member_name ?? '—'}</td>
                      <td className="py-2 pr-3 text-right">{r.qty}</td>
                      <td className="py-2 pr-3 text-right">{formatNTD(r.unit_price)}</td>
                      <td className="py-2 text-right">{formatNTD(r.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : stock.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">近 30 筆無庫存調整紀錄</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3">時間</th>
                  <th className="py-2 pr-3">類型</th>
                  <th className="py-2 pr-3 text-right">變動</th>
                  <th className="py-2 pr-3 text-right">調整後</th>
                  <th className="py-2">備註</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((r) => (
                  <tr key={r.id} className="border-b border-muted/50">
                    <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2 pr-3">
                      {r.type === 'restock' ? '補貨' : r.type === 'loss' ? '盤虧' : '手動設定'}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {r.qty_change >= 0 ? `+${r.qty_change}` : r.qty_change}
                    </td>
                    <td className="py-2 pr-3 text-right">{r.qty_after}</td>
                    <td className="py-2 text-muted-foreground max-w-[200px] truncate">{r.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
