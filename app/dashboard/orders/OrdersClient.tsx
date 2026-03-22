'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye, Pencil, Trash2, RefreshCw, ArrowDown, ArrowUp } from 'lucide-react';
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
  created_at?: string;
  members: { id: string; name: string; client_code: string | null } | null;
};

type OrderSortKey = 'created_at' | 'advance_date' | 'total' | 'order_code';

/** V-001：預交日已過且尚未完成出貨 */
export function isCustomerOrderOverdue(row: OrderRow): boolean {
  if (row.status === 'shipped' || row.status === 'cancelled' || row.status === 'paid') return false;
  if (!row.advance_date) return false;
  const d = row.advance_date.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return d < today;
}

interface OrdersClientProps {
  initialOrders: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: OrderSortKey;
  sortDir: 'asc' | 'desc';
  lastSyncedAt?: string | null;
  lastSyncedCount?: number | null;
}

export function OrdersClient({
  initialOrders,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  lastSyncedAt,
  lastSyncedCount,
}: OrdersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [q, setQ] = useState(searchParams.get('q') ?? '');
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

  function buildParams(overrides?: {
    page?: number;
    q?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    dir?: string;
    pageSize?: number;
  }) {
    const p = new URLSearchParams();
    const query = overrides?.q ?? q;
    const st = overrides?.status ?? statusFilter;
    const df = overrides?.dateFrom ?? dateFrom;
    const dt = overrides?.dateTo ?? dateTo;
    if (query?.trim()) p.set('q', query.trim());
    if (st) p.set('status', st);
    if (df) p.set('dateFrom', df);
    if (dt) p.set('dateTo', dt);
    const sort = overrides?.sort ?? searchParams.get('sort') ?? sortBy;
    const dir = overrides?.dir ?? searchParams.get('dir') ?? sortDir;
    const ps =
      overrides?.pageSize ?? (Number(searchParams.get('pageSize')) || pageSize);
    p.set('sort', sort);
    p.set('dir', dir);
    p.set('pageSize', String(ps));
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

  function handleSortClick(column: OrderSortKey) {
    const curSort = (searchParams.get('sort') || sortBy) as OrderSortKey;
    const curDir = (searchParams.get('dir') || sortDir) as 'asc' | 'desc';
    let nextDir: 'asc' | 'desc';
    if (curSort !== column) {
      nextDir = column === 'order_code' ? 'asc' : 'desc';
    } else {
      nextDir = curDir === 'asc' ? 'desc' : 'asc';
    }
    router.push(
      `/dashboard/orders?${buildParams({ page: 1, sort: column, dir: nextDir })}`
    );
  }

  function handlePageSizeChange(next: number) {
    router.push(`/dashboard/orders?${buildParams({ page: 1, pageSize: next })}`);
  }

  function SortTh({
    column,
    label,
    className,
  }: {
    column: OrderSortKey;
    label: string;
    className?: string;
  }) {
    const curSort = (searchParams.get('sort') || sortBy) as OrderSortKey;
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

  async function refresh() {
    const res = await fetchCustomerOrders({
      q: searchParams.get('q') ?? undefined,
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page,
      pageSize: Number(searchParams.get('pageSize')) || pageSize,
      sortBy: (searchParams.get('sort') || sortBy) as OrderSortKey,
      sortDir: (searchParams.get('dir') || sortDir) as 'asc' | 'desc',
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

  const handleEasyStoreSync = async (mode: 'incremental' | 'full' = 'incremental') => {
    setSyncing(true);
    try {
      const res = await fetch('/api/easystore/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? '同步失敗');
      } else {
        toast.success(
          `${mode === 'full' ? '全量' : data.since ? '增量' : '首次增量（等同全量）'}同步完成：${data.synced} 筆成功` +
          `${data.failed > 0 ? `，${data.failed} 筆失敗` : ''}` +
          `${data.since ? `（自 ${String(data.since).slice(0, 10)} 起）` : ''}`
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
      const parts = m.name?.trim().split(/\s+/) ?? [];
      const name = parts.length === 2 ? `${parts[1]} ${parts[0]}` : m.name;
      return m.client_code ? `${name}（${m.client_code}）` : name;
    }
    return '—';
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string }> = {
      pending: { label: '待出貨', color: 'bg-amber-100 text-amber-800' },
      partial: { label: '部分出貨', color: 'bg-blue-100 text-blue-800' },
      shipped: { label: '已出貨', color: 'bg-green-100 text-green-800' },
      cancelled: { label: '已取消', color: 'bg-muted text-muted-foreground' },
      paid: { label: '已出貨', color: 'bg-green-100 text-green-800' },
      unpaid: { label: '待出貨', color: 'bg-amber-100 text-amber-800' },
    };
    const s = map[status] ?? { label: status, color: 'bg-muted text-muted-foreground' };
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    );
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
          <option value="partial">部分出貨</option>
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
          placeholder="搜尋訂單號 / 姓名 / 手機 / 日期（如 2020-03）"
          className="flex-1 min-w-[240px]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
        <Button variant="outline" onClick={() => handleEasyStoreSync('incremental')} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '增量同步'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleEasyStoreSync('full')} disabled={syncing}>
          全量同步
        </Button>
        {lastSyncedAt && (
          <span className="text-xs text-muted-foreground">
            上次同步：
            {new Date(lastSyncedAt).toLocaleString('zh-TW', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {lastSyncedCount != null ? `（${lastSyncedCount} 筆）` : ''}
          </span>
        )}
        <div className="flex items-center gap-2 text-sm w-full sm:w-auto sm:ml-auto">
          <span className="text-muted-foreground whitespace-nowrap">每頁</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={String(pageSize)}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} 筆
              </option>
            ))}
          </select>
        </div>
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
                  <SortTh column="order_code" label="訂單號碼" className="text-left" />
                  <SortTh column="advance_date" label="預交日期" className="text-left" />
                  <th className="text-left py-3 px-4 font-semibold">客戶名稱</th>
                  <th className="text-left py-3 px-4 font-semibold">銷售方式</th>
                  <SortTh column="total" label="原幣合計" className="text-right" />
                  <th className="text-left py-3 px-4 font-semibold">狀態</th>
                  <SortTh column="created_at" label="建立" className="text-left" />
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((row) => {
                  const overdue = isCustomerOrderOverdue(row);
                  return (
                    <tr
                      key={row.id}
                      className={
                        overdue
                          ? 'border-t bg-amber-50/80 dark:bg-amber-950/25 border-l-4 border-l-amber-600'
                          : 'border-t'
                      }
                    >
                      <td className="py-3 px-4 font-medium">{row.order_code}</td>
                      <td className="py-3 px-4">
                        <span className={overdue ? 'font-semibold text-amber-800 dark:text-amber-200' : undefined}>
                          {row.advance_date ?? '—'}
                        </span>
                        {overdue && (
                          <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">逾期</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{customerName(row)}</td>
                      <td className="py-3 px-4">{row.sales_channel ?? '—'}</td>
                      <td className="py-3 px-4 text-right">{formatNTD(row.total ?? 0)}</td>
                      <td className="py-3 px-4">{statusBadge(row.status)}</td>
                      <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleDateString('zh-TW')
                          : '—'}
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
