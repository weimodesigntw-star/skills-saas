'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/ImportDialog';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MemberDialog } from '@/components/members/MemberDialog';
import { fetchMembers, deleteMember, type CustomerMember } from '@/app/actions/customer-members';
import { Users, ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';

type MemberSortKey = 'created_at' | 'name' | 'total_spent' | 'order_count';

interface MembersClientProps {
  initialMembers: CustomerMember[];
  total: number;
  page: number;
  pageSize: number;
  sortBy: MemberSortKey;
  sortDir: 'asc' | 'desc';
  /** ES-004：EasyStore 會員同步狀態 */
  lastSyncedAt?: string | null;
  lastSyncedCount?: number | null;
}

export function MembersClient({
  initialMembers,
  total,
  page,
  pageSize,
  sortBy,
  sortDir,
  lastSyncedAt,
  lastSyncedCount,
}: MembersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<CustomerMember[]>(initialMembers);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingMember, setEditingMember] = useState<CustomerMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSearch() {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('search', searchInput.trim());
    params.set('sort', searchParams.get('sort') || sortBy);
    params.set('dir', searchParams.get('dir') || sortDir);
    params.set('pageSize', searchParams.get('pageSize') || String(pageSize));
    params.set('page', '1');
    router.push(`/dashboard/members?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    if (!params.get('sort')) {
      params.set('sort', sortBy);
      params.set('dir', sortDir);
    }
    if (!params.get('pageSize')) params.set('pageSize', String(pageSize));
    router.push(`/dashboard/members?${params.toString()}`);
  }

  function handleSortClick(column: MemberSortKey) {
    const curSort = (searchParams.get('sort') || sortBy) as MemberSortKey;
    const curDir = (searchParams.get('dir') || sortDir) as 'asc' | 'desc';
    let nextDir: 'asc' | 'desc';
    if (curSort !== column) {
      nextDir = column === 'name' ? 'asc' : 'desc';
    } else {
      nextDir = curDir === 'asc' ? 'desc' : 'asc';
    }
    const p = new URLSearchParams(searchParams.toString());
    p.set('sort', column);
    p.set('dir', nextDir);
    p.set('page', '1');
    if (!p.get('pageSize')) p.set('pageSize', String(pageSize));
    router.push(`/dashboard/members?${p.toString()}`);
  }

  function handlePageSizeChange(next: number) {
    const p = new URLSearchParams(searchParams.toString());
    p.set('pageSize', String(next));
    p.set('page', '1');
    if (!p.get('sort')) {
      p.set('sort', sortBy);
      p.set('dir', sortDir);
    }
    router.push(`/dashboard/members?${p.toString()}`);
  }

  function SortTh({
    column,
    label,
    className,
  }: {
    column: MemberSortKey;
    label: string;
    className?: string;
  }) {
    const curSort = (searchParams.get('sort') || sortBy) as MemberSortKey;
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
    const res = await fetchMembers({
      search: searchParams.get('search') ?? undefined,
      page,
      pageSize: Number(searchParams.get('pageSize')) || pageSize,
      sortBy: (searchParams.get('sort') || sortBy) as MemberSortKey,
      sortDir: (searchParams.get('dir') || sortDir) as 'asc' | 'desc',
    });
    setMembers(res.members);
  }

  async function handleDelete(id: string) {
    const result = await deleteMember(id);
    setDeleteConfirm(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('已刪除會員');
    refresh();
  }

  const handleEasyStoreSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/easystore/sync-customers', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? '同步失敗');
      } else {
        toast.success(
          `同步完成：${data.synced} 筆成功${data.failed > 0 ? `，${data.failed} 筆失敗` : ''}`
        );
        refresh();
      }
    } catch {
      toast.error('網路錯誤，請稍後再試');
    } finally {
      setSyncing(false);
    }
  };

  const handleBackfillStats = async () => {
    setBackfilling(true);
    try {
      const res = await fetch('/api/easystore/backfill-members-stats', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? '回填失敗');
      } else {
        toast.success(`會員統計已回填：${data.updated ?? 0} 筆`);
        refresh();
      }
    } catch {
      toast.error('網路錯誤，請稍後再試');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">會員管理</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <Input
          placeholder="搜尋姓名 / 電話 / Email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-xs"
        />
        <Button onClick={handleSearch}>查詢</Button>
        <Button variant="outline" onClick={handleEasyStoreSync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? '同步中...' : '同步新增/異動會員'}
        </Button>
        {lastSyncedAt && (
          <span className="text-xs text-muted-foreground self-center">
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
        <Button variant="outline" onClick={handleBackfillStats} disabled={backfilling}>
          {backfilling ? '回填中...' : '回填會員統計'}
        </Button>
        <ImportDialog type="members" />
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增會員
        </Button>
        <div className="flex items-center gap-2 text-sm">
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

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <SortTh column="name" label="姓名" className="text-left" />
              <th className="text-left py-3 px-4 font-semibold">電話</th>
              <th className="text-left py-3 px-4 font-semibold">Email</th>
              <SortTh column="total_spent" label="累計消費" className="text-right" />
              <SortTh column="order_count" label="消費次數" className="text-right" />
              <SortTh column="created_at" label="建立時間" className="text-left" />
              <th className="text-left py-3 px-4 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12">
                  <EmptyState
                    icon={Users}
                    title="尚無會員"
                    description="點擊「新增會員」建立第一筆會員資料"
                    action={
                      <Button onClick={() => setOpenCreate(true)}>
                        <Plus className="mr-1 h-4 w-4" />
                        新增會員
                      </Button>
                    }
                  />
                </td>
              </tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="border-t hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/members/${member.id}`}
                      className="hover:underline font-medium text-primary"
                    >
                      {member.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{member.phone ?? '—'}</td>
                  <td className="py-3 px-4 text-muted-foreground">{member.email ?? '—'}</td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatNTD(Number(member.total_spent))}
                  </td>
                  <td className="py-3 px-4 text-right">{member.order_count ?? member.visit_count} 次</td>
                  <td className="py-3 px-4 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(member.created_at).toLocaleDateString('zh-TW')}
                  </td>
                  <td className="py-3 px-4">
                    <Button size="sm" variant="ghost" className="h-8" asChild>
                      <Link href={`/dashboard/members/${member.id}`}>查看</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => setEditingMember(member)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      編輯
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm({ id: member.id, name: member.name })}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      刪除
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            上一頁
          </Button>
          <span className="text-sm text-muted-foreground">
            第 {page} / {totalPages} 頁（共 {total} 筆）
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            下一頁
          </Button>
        </div>
      )}

      <MemberDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onSuccess={refresh}
      />
      <MemberDialog
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        member={editingMember}
        onSuccess={refresh}
      />
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="刪除會員"
        description={deleteConfirm ? `確定要刪除「${deleteConfirm.name}」？此操作無法復原。` : ''}
        confirmLabel="刪除"
        variant="destructive"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
      />
    </div>
  );
}
