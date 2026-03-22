'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye, DollarSign, Ban, ArrowDown, ArrowUp, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fetchPurchaseOrders, voidPurchaseOrder } from '@/app/actions/purchase-orders';
import { getVendors } from '@/app/actions/vendors';
import { toast } from '@/components/ui/toast';
import { ShoppingCart } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { PayPurchaseDialog } from '@/components/purchases/PayPurchaseDialog';

type PurchaseRow = {
  id: string;
  receive_code: string;
  receive_day: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  total: number;
  amt_paid: number;
  amt_unpaid: number;
  status: string;
  vendors: { id: string; vendor_code: string; vendor_name: string } | null;
};

/** 後端可排序欄（含預設 created_at）；表頭僅三欄可點 */
type PurchaseSortKey = 'receive_day' | 'total' | 'amt_unpaid' | 'created_at';
type PurchaseSortKeyUi = 'receive_day' | 'total' | 'amt_unpaid';

interface PurchasesClientProps {
  initialPurchases: PurchaseRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: PurchaseSortKey;
  sortDir: 'asc' | 'desc';
}

export function PurchasesClient({
  initialPurchases,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: PurchasesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [purchases, setPurchases] = useState<PurchaseRow[]>(initialPurchases);
  const [vendorId, setVendorId] = useState(searchParams.get('vendorId') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');
  const [voidId, setVoidId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [payPurchaseId, setPayPurchaseId] = useState<string | null>(null);
  const [vendors, setVendors] = useState<{ id: string; vendor_code: string; vendor_name: string }[]>([]);

  useEffect(() => {
    setPurchases(initialPurchases);
  }, [initialPurchases]);
  useEffect(() => {
    getVendors().then(setVendors);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildParams(overrides?: { page?: number; sort?: string; dir?: string }) {
    const p = new URLSearchParams();
    if (vendorId) p.set('vendorId', vendorId);
    if (statusFilter) p.set('status', statusFilter);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    const sort = overrides?.sort ?? searchParams.get('sort') ?? sortBy;
    const dir = overrides?.dir ?? searchParams.get('dir') ?? sortDir;
    p.set('sort', sort);
    p.set('dir', dir);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  function handleSearch() {
    router.push(`/dashboard/purchases?${buildParams({ page: 1 })}`);
  }

  function handleSortClick(column: PurchaseSortKeyUi) {
    const curSort = (searchParams.get('sort') || sortBy) as PurchaseSortKey;
    const curDir = (searchParams.get('dir') || sortDir) as 'asc' | 'desc';
    let nextDir: 'asc' | 'desc';
    if (curSort !== column) {
      nextDir = 'desc';
    } else {
      nextDir = curDir === 'asc' ? 'desc' : 'asc';
    }
    router.push(`/dashboard/purchases?${buildParams({ page: 1, sort: column, dir: nextDir })}`);
  }

  function SortTh({
    column,
    label,
    className,
  }: {
    column: PurchaseSortKeyUi;
    label: string;
    className?: string;
  }) {
    const curSort = (searchParams.get('sort') || sortBy) as PurchaseSortKey;
    const curDir = (searchParams.get('dir') || sortDir) as 'asc' | 'desc';
    const active = curSort === column;
    return (
      <th className={`py-3 px-4 font-semibold ${className ?? ''}`}>
        <button
          type="button"
          onClick={() => handleSortClick(column)}
          className="inline-flex items-center gap-1 hover:text-primary hover:underline"
        >
          {label}
          {active ? (
            curDir === 'asc' ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : null}
        </button>
      </th>
    );
  }

  async function handleVoid() {
    if (!voidId) return;
    setIsVoiding(true);
    const result = await voidPurchaseOrder(voidId);
    setIsVoiding(false);
    setVoidId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('採購單已作廢');
    router.refresh();
  }

  const vendorLabel = (row: PurchaseRow) =>
    row.vendor_name ?? row.vendors?.vendor_name ?? '—';

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">採購管理</h1>
        <Button asChild>
          <Link href="/dashboard/purchases/new">
            <Plus className="mr-1 h-4 w-4" />
            新增採購單
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[160px]"
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
        >
          <option value="">全部廠商</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.vendor_name}（{v.vendor_code}）</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[120px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="採購單狀態篩選"
        >
          <option value="">全部</option>
          <option value="ongoing">進行中</option>
          <option value="completed">完成</option>
          <option value="void">取消</option>
        </select>
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
      </div>

      {purchases.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="尚無採購單"
          description="點擊「新增採購單」開始進貨"
          action={
            <Button asChild>
              <Link href="/dashboard/purchases/new">
                <Plus className="mr-1 h-4 w-4" />
                新增採購單
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">採購單號</th>
                  <SortTh column="receive_day" label="進貨日期" className="text-left" />
                  <th className="text-left py-3 px-4 font-semibold">廠商名稱</th>
                  <SortTh column="total" label="合計" className="text-right" />
                  <th className="text-right py-3 px-4 font-semibold">已付</th>
                  <SortTh column="amt_unpaid" label="未付" className="text-right" />
                  <th className="text-left py-3 px-4 font-semibold">狀態</th>
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => {
                  const unpaid = Number(row.amt_unpaid);
                  /** V-003：避免字串/小數誤差；>0 才標橘底+橘字（全付清則不會出現） */
                  const hasUnpaid = Number.isFinite(unpaid) && unpaid > 0;
                  return (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4 font-mono">{row.receive_code}</td>
                    <td className="py-3 px-4">{row.receive_day ?? '—'}</td>
                    <td className="py-3 px-4">{vendorLabel(row)}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.total))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.amt_paid))}</td>
                    <td
                      className={cn(
                        'py-3 px-4 text-right tabular-nums',
                        hasUnpaid
                          ? 'bg-orange-50 font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-400'
                          : 'text-muted-foreground'
                      )}
                      data-purchase-amt-unpaid={hasUnpaid ? 'positive' : 'zero'}
                    >
                      {formatNTD(unpaid)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          row.status === 'void'
                            ? 'inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                            : hasUnpaid
                              ? 'inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900'
                              : 'inline-flex rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                        }
                      >
                        {row.status === 'void' ? '取消' : hasUnpaid ? '進行中' : '完成'}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center gap-1 flex-wrap">
                      <Button variant="ghost" size="sm" asChild title="查看">
                        <Link href={`/dashboard/purchases/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {row.status === 'valid' && (
                        <Button variant="outline" size="sm" asChild title="確認進貨">
                          <Link href={`/dashboard/purchases/${row.id}`}>
                            <PackageCheck className="h-4 w-4 mr-1" />
                            確認進貨
                          </Link>
                        </Button>
                      )}
                      {row.status === 'valid' && hasUnpaid && (
                        <Button variant="ghost" size="sm" onClick={() => setPayPurchaseId(row.id)} title="付款">
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
                      {row.status === 'valid' && (
                        <Button variant="ghost" size="sm" onClick={() => setVoidId(row.id)} title="作廢">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/purchases?${buildParams({ page: page - 1 })}`)} disabled={page <= 1}>上一頁</Button>
              <span className="text-sm">第 {page} / {totalPages} 頁</span>
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/purchases?${buildParams({ page: page + 1 })}`)} disabled={page >= totalPages}>下一頁</Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!voidId}
        onOpenChange={(open) => !open && setVoidId(null)}
        title="確認作廢"
        description="確定要作廢此採購單嗎？將回補庫存。"
        onConfirm={handleVoid}
        loading={isVoiding}
      />

      {payPurchaseId && (
        <PayPurchaseDialog
          purchaseId={payPurchaseId}
          open={!!payPurchaseId}
          onOpenChange={(open) => !open && setPayPurchaseId(null)}
          onSuccess={() => {
            setPayPurchaseId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
