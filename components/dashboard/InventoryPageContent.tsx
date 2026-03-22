'use client';

/**
 * 庫存管理內容（共用於 /dashboard/inventory 與 /dashboard/pos/inventory）
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import {
  fetchInventory,
  adjustStock,
  fetchStockHistory,
  type InventoryItem,
  type StockHistoryRecord,
} from '@/app/actions/inventory';
import { fetchPosCategories } from '@/app/actions/pos';
import { ArrowLeft, Search, Package, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

interface InventoryPageContentProps {
  /** 返回按鈕連結，例如 /dashboard 或 /dashboard/pos */
  backHref: string;
}

export function InventoryPageContent({ backHref }: InventoryPageContentProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<'restock' | 'loss' | 'manual'>('restock');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const [historyRecords, setHistoryRecords] = useState<StockHistoryRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFetched, setHistoryFetched] = useState(false);

  const pageSize = 20;

  const loadInventory = useCallback(async () => {
    setLoading(true);
    const res = await fetchInventory({
      categoryId: categoryId === 'all' ? undefined : categoryId,
      lowStockOnly,
      search: search.trim() || undefined,
      page,
      pageSize,
    });
    setItems(res.items);
    setTotal(res.total);
    setLoading(false);
  }, [categoryId, lowStockOnly, search, page, pageSize]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    fetchPosCategories().then((list) =>
      setCategories(list.map((c) => ({ id: c.id, name: c.name })))
    );
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const res = await fetchStockHistory({ productId: undefined, page: historyPage, pageSize: 20 });
    setHistoryRecords(res.records);
    setHistoryTotal(res.total);
    setHistoryLoading(false);
    setHistoryFetched(true);
  }, [historyPage]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const openAdjust = (item: InventoryItem) => {
    setAdjustProduct(item);
    setAdjustType('restock');
    setAdjustQty('');
    setAdjustNote('');
    setAdjustOpen(true);
  };

  const previewQtyAfter = (): number => {
    if (!adjustProduct) return 0;
    const current = adjustProduct.stock;
    const q = Math.floor(Number(adjustQty)) || 0;
    if (adjustType === 'restock') return current + q;
    if (adjustType === 'loss') return Math.max(0, current - q);
    return Math.max(0, q);
  };

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    const qtyNum = Math.floor(Number(adjustQty));
    if (adjustType !== 'manual' && qtyNum <= 0) {
      toast.error('補貨/盤虧數量需為正整數');
      return;
    }
    if (adjustType === 'manual' && qtyNum < 0) {
      toast.error('手動設定庫存不可為負');
      return;
    }
    setAdjustLoading(true);
    const result = await adjustStock({
      productId: adjustProduct.id,
      type: adjustType,
      qty: qtyNum,
      note: adjustNote.trim() || undefined,
    });
    setAdjustLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`調整完成，目前庫存：${result.qtyAfter}`);
    setAdjustOpen(false);
    setAdjustProduct(null);
    loadInventory();
    loadHistory();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const historyPages = Math.max(1, Math.ceil(historyTotal / 20));

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">庫存管理</h1>
          <p className="text-muted-foreground text-sm">查詢庫存、補貨、盤虧與手動設定</p>
        </div>
      </div>

      {/* 篩選 */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">搜尋商品名稱/條碼</Label>
              <Input
                placeholder="輸入關鍵字"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">分類</Label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-40"
              >
                <option value="all">全部</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              <span className="text-sm">只顯示低庫存</span>
            </label>
            <Button variant="secondary" size="sm" onClick={() => loadInventory()}>
              <Search className="h-4 w-4 mr-2" />
              查詢
            </Button>
            {lowStockOnly && items.some((i) => i.is_low_stock) && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/purchases/new?ids=${items
                    .filter((i) => i.is_low_stock)
                    .map((i) => i.id)
                    .join(',')}`}
                >
                  本頁低庫存匯入採購
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* 庫存列表 */}
      <Card>
        <CardHeader>
          <CardTitle>庫存列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="尚無商品"
              description="請先在商品管理新增商品"
            />
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">商品名稱</th>
                      <th className="text-left p-3 font-medium">分類</th>
                      <th className="text-left p-3 font-medium">條碼</th>
                      <th className="text-right p-3 font-medium">目前庫存</th>
                      <th className="text-left p-3 font-medium">狀態</th>
                      <th className="p-3 min-w-[140px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3 text-muted-foreground">{item.category_name ?? '—'}</td>
                        <td className="p-3 font-mono text-muted-foreground">{item.barcode ?? '—'}</td>
                        <td className="p-3 text-right">{item.stock}</td>
                        <td className="p-3">
                          {item.is_low_stock ? (
                            <span className="inline-flex items-center gap-1 text-destructive font-medium">
                              <AlertTriangle className="h-4 w-4" />
                              低庫存
                            </span>
                          ) : (
                            <span className="text-muted-foreground">正常</span>
                          )}
                        </td>
                        <td className="p-3 flex flex-wrap gap-1 justify-end">
                          {item.is_low_stock && (
                            <Button variant="secondary" size="sm" asChild>
                              <Link href={`/dashboard/purchases/new?ids=${item.id}`}>採購</Link>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openAdjust(item)}>
                            調整
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    共 {total} 筆，第 {page} / {totalPages} 頁
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" /> 上一頁
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      下一頁 <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 調整歷史 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>調整歷史</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading && !historyFetched ? (
            <Skeleton className="h-32 w-full" />
          ) : historyRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">尚無調整記錄</p>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">時間</th>
                      <th className="text-left p-3 font-medium">商品</th>
                      <th className="text-left p-3 font-medium">類型</th>
                      <th className="text-right p-3 font-medium">變動量</th>
                      <th className="text-right p-3 font-medium">調整後</th>
                      <th className="text-left p-3 font-medium">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3 text-muted-foreground">
                          {new Date(r.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3">{r.product_name}</td>
                        <td className="p-3">
                          {r.type === 'restock' ? '補貨' : r.type === 'loss' ? '盤虧' : '手動設定'}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {r.qty_change >= 0 ? `+${r.qty_change}` : r.qty_change}
                        </td>
                        <td className="p-3 text-right">{r.qty_after}</td>
                        <td className="p-3 text-muted-foreground">{r.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyPages > 1 && (
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
                    上一頁
                  </Button>
                  <Button variant="outline" size="sm" disabled={historyPage >= historyPages} onClick={() => setHistoryPage((p) => p + 1)}>
                    下一頁
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 調整 Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整庫存{adjustProduct ? `：${adjustProduct.name}` : ''}</DialogTitle>
          </DialogHeader>
          {adjustProduct && (
            <>
              <p className="text-sm text-muted-foreground">目前庫存：<strong>{adjustProduct.stock}</strong></p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>調整類型</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={adjustType === 'restock'} onChange={() => setAdjustType('restock')} />
                      補貨
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={adjustType === 'loss'} onChange={() => setAdjustType('loss')} />
                      盤虧
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={adjustType === 'manual'} onChange={() => setAdjustType('manual')} />
                      手動設定
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>
                    {adjustType === 'manual' ? '目標庫存數量' : '數量'}
                  </Label>
                  <Input
                    type="number"
                    min={adjustType === 'manual' ? 0 : 1}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder={adjustType === 'manual' ? '直接設定為此數值' : '正整數'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {adjustType === 'restock' && '現有庫存 + 數量'}
                    {adjustType === 'loss' && '現有庫存 - 數量（最低為 0）'}
                    {adjustType === 'manual' && '直接設定為此數值'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>備註（選填）</Label>
                  <Input
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="例：到貨補庫、盤點損耗"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  預覽：調整後庫存將為 <strong>{previewQtyAfter()}</strong>
                </p>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>取消</Button>
            <Button onClick={handleAdjust} disabled={adjustLoading || !adjustQty.trim()}>
              {adjustLoading ? '處理中…' : '確認調整'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
