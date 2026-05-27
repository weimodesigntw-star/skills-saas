'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import {
  adjustStock,
  fetchInventory,
  fetchStockHistory,
  type InventoryItem,
  type StockHistoryRecord,
} from '@/app/actions/inventory';
import { createDepot, getDepots } from '@/app/actions/depots';
import { fetchPosCategories } from '@/app/actions/pos';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Warehouse,
} from 'lucide-react';

interface InventoryPageContentProps {
  backHref: string;
}

type InventorySortKey = 'stock' | 'name' | 'barcode';
type DepotOption = { id: string; depot_code: string | null; depot_name: string };

export function InventoryPageContent({ backHref }: InventoryPageContentProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [depotId, setDepotId] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [depots, setDepots] = useState<DepotOption[]>([]);
  const [sortBy, setSortBy] = useState<InventorySortKey>('stock');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<InventoryItem | null>(null);
  const [adjustDepotId, setAdjustDepotId] = useState('');
  const [adjustType, setAdjustType] = useState<'restock' | 'loss' | 'manual'>('restock');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const [depotOpen, setDepotOpen] = useState(false);
  const [depotCode, setDepotCode] = useState('');
  const [depotName, setDepotName] = useState('');
  const [depotNote, setDepotNote] = useState('');
  const [depotLoading, setDepotLoading] = useState(false);

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
      depotId: depotId === 'all' ? undefined : depotId,
      lowStockOnly,
      search: search.trim() || undefined,
      page,
      pageSize,
      sortBy,
      sortDir,
    });
    setItems(res.items);
    setTotal(res.total);
    setLoading(false);
  }, [categoryId, depotId, lowStockOnly, search, page, pageSize, sortBy, sortDir]);

  const loadDepots = useCallback(async () => {
    const list = await getDepots();
    setDepots(list as DepotOption[]);
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
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    fetchPosCategories().then((list) => setCategories(list.map((c) => ({ id: c.id, name: c.name }))));
    loadDepots();
  }, [loadDepots]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, categoryId, depotId, search, lowStockOnly]);

  const selectedDepotStock = useMemo(() => {
    if (!adjustProduct || !adjustDepotId) return 0;
    return adjustProduct.depot_stocks.find((s) => s.depot_id === adjustDepotId)?.qty ?? 0;
  }, [adjustDepotId, adjustProduct]);

  const openAdjust = (item: InventoryItem) => {
    setAdjustProduct(item);
    setAdjustDepotId(item.depot_stocks[0]?.depot_id ?? depots[0]?.id ?? '');
    setAdjustType('restock');
    setAdjustQty('');
    setAdjustNote('');
    setAdjustOpen(true);
  };

  const previewQtyAfter = (): number => {
    const current = selectedDepotStock;
    const q = Math.floor(Number(adjustQty)) || 0;
    if (adjustType === 'restock') return current + q;
    if (adjustType === 'loss') return Math.max(0, current - q);
    return Math.max(0, q);
  };

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    if (!adjustDepotId) {
      toast.error('請先選擇倉庫');
      return;
    }
    const qtyNum = Math.floor(Number(adjustQty));
    if (adjustType !== 'manual' && qtyNum <= 0) {
      toast.error('補貨/盤虧數量必須是正整數');
      return;
    }
    if (adjustType === 'manual' && qtyNum < 0) {
      toast.error('手動設定庫存不可為負');
      return;
    }
    setAdjustLoading(true);
    const result = await adjustStock({
      productId: adjustProduct.id,
      depotId: adjustDepotId,
      type: adjustType,
      qty: qtyNum,
      note: adjustNote.trim() || undefined,
    });
    setAdjustLoading(false);

    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(`調整完成，目前總庫存：${result.qtyAfter}`);
    setAdjustOpen(false);
    setAdjustProduct(null);
    loadInventory();
    loadHistory();
  };

  const handleCreateDepot = async () => {
    if (!depotName.trim()) {
      toast.error('請輸入倉庫名稱');
      return;
    }
    setDepotLoading(true);
    const result = await createDepot({
      depot_code: depotCode.trim() || undefined,
      depot_name: depotName.trim(),
      note: depotNote.trim() || undefined,
    });
    setDepotLoading(false);
    if ('error' in result && result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('倉庫已新增');
    setDepotOpen(false);
    setDepotCode('');
    setDepotName('');
    setDepotNote('');
    loadDepots();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const historyPages = Math.max(1, Math.ceil(historyTotal / 20));
  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));
  const someSelected = items.some((i) => selectedIds.has(i.id));

  function handleInventorySort(column: InventorySortKey) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  }

  function SortInvTh({ column, label, className }: { column: InventorySortKey; label: string; className?: string }) {
    const active = sortBy === column;
    return (
      <th className={`p-3 font-medium ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => handleInventorySort(column)}
          className="inline-flex items-center gap-1 hover:text-primary hover:underline"
        >
          {label}
          {active ? sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" /> : null}
        </button>
      </th>
    );
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6 flex items-center gap-4">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">庫存管理</h1>
          <p className="text-muted-foreground text-sm">依倉庫管理商品庫存，調整與歷史記錄都會保留倉庫資訊</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">搜尋商品名稱/條碼</Label>
              <Input
                placeholder="輸入商品名稱或條碼"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">分類</Label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-40 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="all">全部</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">倉庫</Label>
              <select
                value={depotId}
                onChange={(e) => {
                  setDepotId(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-44 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="all">全部倉庫</option>
                {depots.map((depot) => (
                  <option key={depot.id} value={depot.id}>
                    {depot.depot_name}{depot.depot_code ? `（${depot.depot_code}）` : ''}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              <span className="text-sm">只顯示低庫存</span>
            </label>
            <Button variant="secondary" size="sm" onClick={() => loadInventory()}>
              <Search className="mr-2 h-4 w-4" />
              查詢
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDepotOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              新增倉庫
            </Button>
            {lowStockOnly && items.some((i) => i.is_low_stock) && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={`/dashboard/purchases/new?ids=${items
                    .filter((i) => i.is_low_stock)
                    .map((i) => i.id)
                    .join(',')}`}
                >
                  從低庫存建立採購單
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>庫存列表</CardTitle>
        </CardHeader>
        {selectedIds.size > 0 && (
          <div className="mx-6 mb-4 flex items-center gap-3 rounded-md bg-muted px-4 py-2">
            <span className="text-sm text-muted-foreground">
              已選 <strong>{selectedIds.size}</strong> 項
            </span>
            <Button size="sm" asChild>
              <Link href={`/dashboard/purchases/new?ids=${[...selectedIds].join(',')}`}>
                <ShoppingCart className="mr-1 h-4 w-4" />
                建立採購單
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              清除選取
            </Button>
          </div>
        )}
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={Package} title="沒有商品" description="請先新增商品或調整篩選條件" />
          ) : (
            <>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={toggleAll}
                          className="cursor-pointer"
                        />
                      </th>
                      <SortInvTh column="name" label="商品名稱" className="text-left" />
                      <th className="p-3 text-left font-medium">分類</th>
                      <SortInvTh column="barcode" label="條碼" className="text-left" />
                      <SortInvTh column="stock" label="總庫存" className="text-right" />
                      <th className="p-3 text-left font-medium">各倉庫</th>
                      <th className="p-3 text-left font-medium">狀態</th>
                      <th className="min-w-[140px] p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleOne(item.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3 text-muted-foreground">{item.category_name ?? '—'}</td>
                        <td className="p-3 font-mono text-muted-foreground">{item.barcode ?? '—'}</td>
                        <td className="p-3 text-right tabular-nums">
                          <span className={cn(item.stock <= 5 && 'font-semibold text-red-600')}>{item.stock}</span>
                        </td>
                        <td className="p-3">
                          {item.depot_stocks.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.depot_stocks.map((stock) => (
                                <Badge key={stock.depot_id} variant="outline" className="font-normal">
                                  {stock.depot_name}: {stock.qty}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">尚未分倉</span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.stock === 0 ? (
                            <Badge variant="outline" className="border-red-600 text-red-600">
                              缺貨
                            </Badge>
                          ) : item.is_low_stock ? (
                            <span className="inline-flex items-center gap-1 font-medium text-destructive">
                              <AlertTriangle className="h-4 w-4" />
                              低庫存
                            </span>
                          ) : (
                            <span className="text-muted-foreground">正常</span>
                          )}
                        </td>
                        <td className="flex flex-wrap justify-end gap-1 p-3">
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
                <div className="mt-4 flex items-center justify-between">
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>調整歷史</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading && !historyFetched ? (
            <Skeleton className="h-32 w-full" />
          ) : historyRecords.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">尚無調整記錄</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-3 text-left font-medium">時間</th>
                      <th className="p-3 text-left font-medium">商品</th>
                      <th className="p-3 text-left font-medium">倉庫</th>
                      <th className="p-3 text-left font-medium">類型</th>
                      <th className="p-3 text-right font-medium">變動</th>
                      <th className="p-3 text-right font-medium">調整後</th>
                      <th className="p-3 text-left font-medium">備註</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRecords.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3 text-muted-foreground">
                          {new Date(r.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="p-3">{r.product_name}</td>
                        <td className="p-3 text-muted-foreground">{r.depot_name ?? '—'}</td>
                        <td className="p-3">
                          {r.type === 'restock' ? '補貨' : r.type === 'loss' ? '盤虧' : r.type === 'manual' ? '手動設定' : r.type}
                        </td>
                        <td className="p-3 text-right font-mono">{r.qty_change >= 0 ? `+${r.qty_change}` : r.qty_change}</td>
                        <td className="p-3 text-right">{r.qty_after}</td>
                        <td className="p-3 text-muted-foreground">{r.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {historyPages > 1 && (
                <div className="mt-4 flex justify-end gap-2">
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

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>調整庫存{adjustProduct ? `：${adjustProduct.name}` : ''}</DialogTitle>
          </DialogHeader>
          {adjustProduct && (
            <>
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  總庫存：<strong>{adjustProduct.stock}</strong>
                </p>
                {adjustDepotId && (
                  <p className="text-muted-foreground">
                    此倉目前庫存：<strong>{selectedDepotStock}</strong>
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>倉庫</Label>
                  <select
                    value={adjustDepotId}
                    onChange={(e) => setAdjustDepotId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">請選擇倉庫</option>
                    {depots.map((depot) => (
                      <option key={depot.id} value={depot.id}>
                        {depot.depot_name}{depot.depot_code ? `（${depot.depot_code}）` : ''}
                      </option>
                    ))}
                  </select>
                </div>
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
                  <Label>{adjustType === 'manual' ? '此倉目標庫存數量' : '數量'}</Label>
                  <Input
                    type="number"
                    min={adjustType === 'manual' ? 0 : 1}
                    value={adjustQty}
                    onChange={(e) => setAdjustQty(e.target.value)}
                    placeholder={adjustType === 'manual' ? '直接設定此倉庫存' : '正整數'}
                  />
                  <p className="text-xs text-muted-foreground">
                    {adjustType === 'restock' && '此倉庫存 + 數量'}
                    {adjustType === 'loss' && '此倉庫存 - 數量（最低為 0）'}
                    {adjustType === 'manual' && '直接設定此倉庫存'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>備註（選填）</Label>
                  <Input
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    placeholder="例如：盤點、進貨、移倉修正"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  預覽：此倉調整後庫存將為 <strong>{previewQtyAfter()}</strong>
                </p>
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdjust} disabled={adjustLoading || !adjustQty.trim() || !adjustDepotId}>
              {adjustLoading ? '處理中…' : '確認調整'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={depotOpen} onOpenChange={setDepotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              新增倉庫
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>倉庫名稱</Label>
              <Input value={depotName} onChange={(e) => setDepotName(e.target.value)} placeholder="例如：總倉、門市、寄售倉" />
            </div>
            <div className="space-y-2">
              <Label>倉庫代碼（選填）</Label>
              <Input value={depotCode} onChange={(e) => setDepotCode(e.target.value)} placeholder="例如：MAIN、SHOP、CONSIGN" />
            </div>
            <div className="space-y-2">
              <Label>備註（選填）</Label>
              <Input value={depotNote} onChange={(e) => setDepotNote(e.target.value)} placeholder="倉庫地址或用途" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepotOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateDepot} disabled={depotLoading || !depotName.trim()}>
              {depotLoading ? '新增中…' : '新增倉庫'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
