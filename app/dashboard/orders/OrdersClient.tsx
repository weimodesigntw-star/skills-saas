'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  fetchCustomerOrders,
  deleteCustomerOrder,
} from '@/app/actions/customer-orders';
import { toast } from '@/components/ui/toast';
import { ClipboardList } from 'lucide-react';
import { formatNTD } from '@/lib/constants';

type OrderRow = {
  id: string;
  order_code: string;
  advance_date: string | null;
  member_id: string | null;
  sales_channel: string;
  total: number;
  status: string;
  members: { id: string; name: string; client_code: string | null } | null;
};

interface OrdersClientProps {
  initialOrders: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
}

const statusMap: Record<string, { label: string; variant: 'secondary' | 'default' | 'outline' }> = {
  pending: { label: '待出貨', variant: 'secondary' },
  shipped: { label: '已出貨', variant: 'default' },
  cancelled: { label: '已取消', variant: 'outline' },
};

export function OrdersClient({
  initialOrders,
  total,
  page,
  pageSize,
}: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildParams(overrides?: { page?: number; search?: string; status?: string; dateFrom?: string; dateTo?: string }) {
    const p = new URLSearchParams();
    const s = overrides?.search ?? searchInput;
    const st = overrides?.status ?? statusFilter;
    const df = overrides?.dateFrom ?? dateFrom;
    const dt = overrides?.dateTo ?? dateTo;
    if (s?.trim()) p.set('search', s.trim());
    if (st) p.set('status', st);
    if (df) p.set('dateFrom', df);
    if (dt) p.set('dateTo', dt);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  function handleSearch() {
    router.push(`/dashboard/orders?${buildParams({ page: 1 })}`);
  }

  function handlePageChange(newPage: number) {
    router.push(`/dashboard/orders?${buildParams({ page: newPage })}`);
  }

  async function refresh() {
    const res = await fetchCustomerOrders({
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page,
      pageSize,
    });
    setOrders(res.orders as OrderRow[]);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    const result = await deleteCustomerOrder(deleteId);
    setIsDeleting(false);
    setDeleteId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('訂單已刪除');
    router.refresh();
  }

  const handleEasyStoreSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/easystore/sync-orders', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? '同步失敗');
      } else {
        toast.success(
          `訂單同步完成：${data.synced} 筆成功${data.failed > 0 ? `，${data.failed} 筆失敗` : ''}`
        );
        router.refresh();
      }
    } catch {
      toast.error('網路錯誤，請稍後再試');
    } finally {
      setSyncing(false);
    }
  };

  const customerName = (row: OrderRow) => {
    if (row.members) {
      const m = row.members;
      return m.client_code ? `${m.name}（${m.client_code}）` : m.name;
    }
    return '—';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">客戶訂單</h1>
        <Button asChild>
          <Link href="/dashboard/orders/new">
            <Plus className="mr-1 h-4 w-4" />
            新增訂單
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部狀態</option>
          <option value="pending">待出貨</option>
          <option value="shipped">已出貨</option>
          <option value="cancelled">已取消</option>
        </select>
        <Input
          type="date"
          className="w-40"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="日期起"
        />
        <Input
          type="date"
          className="w-40"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="日期訖"
        />
        <Input
          placeholder="搜尋訂單號"
          className="max-w-xs"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
        <Button variant="outline" onClick={handleEasyStoreSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '從 EasyStore 同步訂單'}
        </Button>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="尚無訂單"
          description="點擊「新增訂單」建立第一筆客戶訂單"
          action={
            <Button asChild>
              <Link href="/dashboard/orders/new">
                <Plus className="mr-1 h-4 w-4" />
                新增訂單
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">訂單號碼</th>
                  <th className="text-left py-3 px-4 font-semibold">預交日期</th>
                  <th className="text-left py-3 px-4 font-semibold">客戶名稱</th>
                  <th className="text-left py-3 px-4 font-semibold">銷售方式</th>
                  <th className="text-right py-3 px-4 font-semibold">原幣合計</th>
                  <th className="text-left py-3 px-4 font-semibold">狀態</th>
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => {
                  const statusInfo = statusMap[row.status] ?? { label: row.status, variant: 'outline' as const };
                  return (
                    <tr key={row.id} className="border-t">
                      <td className="py-3 px-4 font-medium">{row.order_code}</td>
                      <td className="py-3 px-4">{row.advance_date ?? '—'}</td>
                      <td className="py-3 px-4">{customerName(row)}</td>
                      <td className="py-3 px-4">{row.sales_channel ?? '—'}</td>
                      <td className="py-3 px-4 text-right">{formatNTD(row.total ?? 0)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            statusInfo.variant === 'secondary'
                              ? 'inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800'
                              : statusInfo.variant === 'default'
                                ? 'inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                                : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                          }
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/orders/${row.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/orders/${row.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                上一頁
              </Button>
              <span className="text-sm">
                第 {page} / {totalPages} 頁
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                下一頁
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="確認刪除"
        description="確定要刪除此訂單嗎？明細將一併刪除，此操作無法復原。"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  );
}
