'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye, ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchWriteoffs, type WriteoffListRow } from '@/app/actions/receivable-writeoffs';
import { fetchMembers } from '@/app/actions/customer-members';
import { toast } from '@/components/ui/toast';
import { Receipt } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { MemberCombobox } from '@/components/ui/member-combobox';

type WriteoffSortKey =
  | 'writeoff_code'
  | 'writeoff_date'
  | 'total_charge'
  | 'discount'
  | 'actual_recd'
  | 'created_at';

interface ReceivablesClientProps {
  initialWriteoffs: WriteoffListRow[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: WriteoffSortKey;
  sortDir: 'asc' | 'desc';
}

export function ReceivablesClient({
  initialWriteoffs,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
}: ReceivablesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [writeoffs, setWriteoffs] = useState<WriteoffListRow[]>(initialWriteoffs);
  const [memberId, setMemberId] = useState(searchParams.get('memberId') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');
  const [members, setMembers] = useState<{ id: string; name: string; client_code: string | null }[]>([]);

  useEffect(() => {
    setWriteoffs(initialWriteoffs);
  }, [initialWriteoffs]);

  useEffect(() => {
    fetchMembers({ pageSize: 500 }).then((r) =>
      setMembers(r.members as { id: string; name: string; client_code: string | null }[])
    );
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildParams(overrides?: {
    page?: number;
    memberId?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    dir?: string;
  }) {
    const p = new URLSearchParams();
    const m = overrides?.memberId ?? memberId;
    const df = overrides?.dateFrom ?? dateFrom;
    const dt = overrides?.dateTo ?? dateTo;
    if (m) p.set('memberId', m);
    if (df) p.set('dateFrom', df);
    if (dt) p.set('dateTo', dt);
    const sort = overrides?.sort ?? searchParams.get('sort') ?? sortBy;
    const dir = overrides?.dir ?? searchParams.get('dir') ?? sortDir;
    p.set('sort', sort);
    p.set('dir', dir);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  function handleSearch() {
    router.push(`/dashboard/receivables?${buildParams({ page: 1 })}`);
  }

  function handleSortClick(column: WriteoffSortKey) {
    const curSort = (searchParams.get('sort') || sortBy) as WriteoffSortKey;
    const curDir = (searchParams.get('dir') || sortDir) as 'asc' | 'desc';
    let nextDir: 'asc' | 'desc';
    if (curSort !== column) {
      nextDir = column === 'writeoff_code' || column === 'writeoff_date' ? 'asc' : 'desc';
    } else {
      nextDir = curDir === 'asc' ? 'desc' : 'asc';
    }
    router.push(`/dashboard/receivables?${buildParams({ page: 1, sort: column, dir: nextDir })}`);
  }

  function SortTh({
    column,
    label,
    className,
  }: {
    column: WriteoffSortKey;
    label: string;
    className?: string;
  }) {
    const curSort = (searchParams.get('sort') || sortBy) as WriteoffSortKey;
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

  const customerLabel = (row: WriteoffListRow) => {
    const m = row.members;
    return m ? (m.client_code ? `${m.name}（${m.client_code}）` : m.name) : '—';
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">應收沖帳</h1>
        <Button asChild>
          <Link href="/dashboard/receivables/new">
            <Plus className="mr-1 h-4 w-4" />
            新增沖帳
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <MemberCombobox
          members={members}
          value={memberId}
          onChange={setMemberId}
          placeholder="搜尋沖帳客戶"
          allLabel="全部客戶"
        />
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
      </div>

      {writeoffs.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="尚無沖帳記錄"
          description="點擊「新增沖帳」開始對帳"
          action={
            <Button asChild>
              <Link href="/dashboard/receivables/new">
                <Plus className="mr-1 h-4 w-4" />
                新增沖帳
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
                  <SortTh column="writeoff_code" label="沖帳單號" className="text-left" />
                  <SortTh column="writeoff_date" label="日期" className="text-left" />
                  <th className="text-left py-3 px-4 font-semibold">客戶</th>
                  <th className="text-left py-3 px-4 font-semibold">來源單號</th>
                  <SortTh column="total_charge" label="應收總額" className="text-right" />
                  <SortTh column="discount" label="折讓" className="text-right" />
                  <SortTh column="actual_recd" label="實收" className="text-right" />
                  <th className="text-left py-3 px-4 font-semibold">備註</th>
                  <SortTh column="created_at" label="建立" className="text-left whitespace-nowrap" />
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {writeoffs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4 font-mono">{row.writeoff_code}</td>
                    <td className="py-3 px-4">{row.writeoff_date}</td>
                    <td className="py-3 px-4">{customerLabel(row)}</td>
                    <td className="py-3 px-4 font-mono text-xs">{row.source_doc ?? '—'}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.total_charge))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.discount))}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatNTD(Number(row.actual_recd))}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[120px] truncate">{row.note ?? '—'}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString('zh-TW')
                        : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/receivables/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/receivables?${buildParams({ page: page - 1 })}`)} disabled={page <= 1}>
                上一頁
              </Button>
              <span className="text-sm">第 {page} / {totalPages} 頁</span>
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/receivables?${buildParams({ page: page + 1 })}`)} disabled={page >= totalPages}>
                下一頁
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
