'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye, DollarSign, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { fetchPurchaseOrders, voidPurchaseOrder } from '@/app/actions/purchase-orders';
import { getVendors } from '@/app/actions/vendors';
import { toast } from '@/components/ui/toast';
import { ShoppingCart } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
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

interface PurchasesClientProps {
  initialPurchases: PurchaseRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function PurchasesClient({
  initialPurchases,
  total,
  page,
  pageSize,
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

  function buildParams(overrides?: { page?: number }) {
    const p = new URLSearchParams();
    if (vendorId) p.set('vendorId', vendorId);
    if (statusFilter) p.set('status', statusFilter);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  function handleSearch() {
    router.push(`/dashboard/purchases?${buildParams({ page: 1 })}`);
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
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部狀態</option>
          <option value="valid">有效</option>
          <option value="void">已作廢</option>
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
                  <th className="text-left py-3 px-4 font-semibold">進貨日期</th>
                  <th className="text-left py-3 px-4 font-semibold">廠商名稱</th>
                  <th className="text-right py-3 px-4 font-semibold">合計</th>
                  <th className="text-right py-3 px-4 font-semibold">已付</th>
                  <th className="text-right py-3 px-4 font-semibold">未付</th>
                  <th className="text-left py-3 px-4 font-semibold">狀態</th>
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((row) => {
                  const unpaid = Number(row.amt_unpaid);
                  return (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4 font-mono">{row.receive_code}</td>
                    <td className="py-3 px-4">{row.receive_day ?? '—'}</td>
                    <td className="py-3 px-4">{vendorLabel(row)}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.total))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.amt_paid))}</td>
                    <td
                      className={
                        unpaid > 0
                          ? 'py-3 px-4 text-right text-orange-600 font-semibold'
                          : 'py-3 px-4 text-right text-muted-foreground'
                      }
                    >
                      {formatNTD(unpaid)}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          row.status === 'valid'
                            ? 'inline-flex rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                            : 'inline-flex rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                        }
                      >
                        {row.status === 'valid' ? '有效' : '已作廢'}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/purchases/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {row.status === 'valid' && Number(row.amt_unpaid) > 0 && (
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
