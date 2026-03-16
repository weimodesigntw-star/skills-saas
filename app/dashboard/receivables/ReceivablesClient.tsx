'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchWriteoffs } from '@/app/actions/receivable-writeoffs';
import { fetchMembers } from '@/app/actions/customer-members';
import { toast } from '@/components/ui/toast';
import { Receipt } from 'lucide-react';
import { formatNTD } from '@/lib/constants';

type WriteoffRow = {
  id: string;
  writeoff_code: string;
  writeoff_date: string;
  member_id: string | null;
  total_charge: number;
  discount: number;
  actual_recd: number;
  note: string | null;
  members: { id: string; name: string; client_code: string | null } | null;
};

interface ReceivablesClientProps {
  initialWriteoffs: WriteoffRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function ReceivablesClient({
  initialWriteoffs,
  total,
  page,
  pageSize,
}: ReceivablesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [writeoffs, setWriteoffs] = useState<WriteoffRow[]>(initialWriteoffs);
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

  function buildParams(overrides?: { page?: number; memberId?: string; dateFrom?: string; dateTo?: string }) {
    const p = new URLSearchParams();
    const m = overrides?.memberId ?? memberId;
    const df = overrides?.dateFrom ?? dateFrom;
    const dt = overrides?.dateTo ?? dateTo;
    if (m) p.set('memberId', m);
    if (df) p.set('dateFrom', df);
    if (dt) p.set('dateTo', dt);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  function handleSearch() {
    router.push(`/dashboard/receivables?${buildParams({ page: 1 })}`);
  }

  const customerLabel = (row: WriteoffRow) => {
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
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[180px]"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
        >
          <option value="">全部客戶</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.client_code ? `${m.name}（${m.client_code}）` : m.name}
            </option>
          ))}
        </select>
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
                  <th className="text-left py-3 px-4 font-semibold">沖帳單號</th>
                  <th className="text-left py-3 px-4 font-semibold">日期</th>
                  <th className="text-left py-3 px-4 font-semibold">客戶</th>
                  <th className="text-right py-3 px-4 font-semibold">應收總額</th>
                  <th className="text-right py-3 px-4 font-semibold">折讓</th>
                  <th className="text-right py-3 px-4 font-semibold">實收</th>
                  <th className="text-left py-3 px-4 font-semibold">備註</th>
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {writeoffs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4 font-mono">{row.writeoff_code}</td>
                    <td className="py-3 px-4">{row.writeoff_date}</td>
                    <td className="py-3 px-4">{customerLabel(row)}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.total_charge))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.discount))}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatNTD(Number(row.actual_recd))}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[120px] truncate">{row.note ?? '—'}</td>
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
