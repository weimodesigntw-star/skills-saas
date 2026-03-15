'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { MemberDialog } from '@/components/members/MemberDialog';
import { fetchMembers, deleteMember, type CustomerMember } from '@/app/actions/customer-members';
import { Users } from 'lucide-react';
import { toast } from '@/components/ui/toast';

interface MembersClientProps {
  initialMembers: CustomerMember[];
  total: number;
  page: number;
  pageSize: number;
}

export function MembersClient({
  initialMembers,
  total,
  page,
  pageSize,
}: MembersClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<CustomerMember[]>(initialMembers);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingMember, setEditingMember] = useState<CustomerMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSearch() {
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('search', searchInput.trim());
    params.set('page', '1');
    router.push(`/dashboard/members?${params.toString()}`);
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`/dashboard/members?${params.toString()}`);
  }

  async function refresh() {
    const res = await fetchMembers({
      search: searchParams.get('search') ?? undefined,
      page,
      pageSize,
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
        <Button onClick={() => setOpenCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增會員
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-3 px-4 font-semibold">姓名</th>
              <th className="text-left py-3 px-4 font-semibold">電話</th>
              <th className="text-left py-3 px-4 font-semibold">Email</th>
              <th className="text-right py-3 px-4 font-semibold">累計消費</th>
              <th className="text-right py-3 px-4 font-semibold">消費次數</th>
              <th className="text-left py-3 px-4 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12">
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
                    NT$ {Number(member.total_spent).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right">{member.visit_count} 次</td>
                  <td className="py-3 px-4">
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
