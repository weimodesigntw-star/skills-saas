'use client';

/**
 * 字軌設定頁：管理發票字軌與流水號
 * 列表、新增、編輯、啟用切換、刪除（已開立發票者不可刪）
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  fetchInvoiceSequences,
  createInvoiceSequence,
  updateInvoiceSequence,
  deleteInvoiceSequence,
  type InvoiceSequence,
  type InvoiceSequenceInput,
} from '@/app/actions/invoice-sequences';
import { toast } from '@/components/ui/toast';
import { ArrowLeft, Plus, Pencil, Trash2, Hash } from 'lucide-react';

const defaultForm: InvoiceSequenceInput = {
  track_prefix: '',
  year_month: '',
  start_number: 1,
  end_number: 99999999,
};

export default function SequencesPage() {
  const [list, setList] = useState<InvoiceSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [target, setTarget] = useState<InvoiceSequence | null>(null);
  const [form, setForm] = useState<InvoiceSequenceInput & { current_number?: number }>(defaultForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchInvoiceSequences();
    setList(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm(defaultForm);
    setAddOpen(true);
  };

  const openEdit = (seq: InvoiceSequence) => {
    setTarget(seq);
    setForm({
      track_prefix: seq.track_prefix,
      year_month: seq.year_month,
      start_number: seq.start_number,
      end_number: seq.end_number,
      current_number: seq.current_number,
    });
    setEditOpen(true);
  };

  const openDelete = (seq: InvoiceSequence) => {
    setTarget(seq);
    setDeleteOpen(true);
  };

  const handleAdd = async () => {
    setSubmitLoading(true);
    const result = await createInvoiceSequence(form);
    setSubmitLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('已新增字軌');
    setAddOpen(false);
    load();
  };

  const handleEdit = async () => {
    if (!target) return;
    setSubmitLoading(true);
    const result = await updateInvoiceSequence(target.id, {
      track_prefix: form.track_prefix,
      year_month: form.year_month,
      start_number: form.start_number,
      end_number: form.end_number,
      current_number: form.current_number,
    });
    setSubmitLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('已更新字軌');
    setEditOpen(false);
    setTarget(null);
    load();
  };

  const handleToggleActive = async (seq: InvoiceSequence) => {
    const result = await updateInvoiceSequence(seq.id, { is_active: !seq.is_active });
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success(seq.is_active ? '已停用字軌' : '已啟用字軌');
    load();
  };

  const handleDelete = async () => {
    if (!target) return;
    setDeleteLoading(true);
    const result = await deleteInvoiceSequence(target.id);
    setDeleteLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('已刪除字軌');
    setDeleteOpen(false);
    setTarget(null);
    load();
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pos/settings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">字軌設定</h1>
            <p className="text-muted-foreground text-sm">
              管理發票字軌與流水號，開立發票時將從「啟用中」字軌取號
            </p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          新增字軌
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>字軌列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={Hash}
              title="尚無字軌"
              description="新增字軌後，啟用其中一組即可在開立發票時自動取號"
              action={
                <Button onClick={openAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  新增字軌
                </Button>
              }
            />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">字軌前綴</th>
                    <th className="text-left p-3 font-medium">期別</th>
                    <th className="text-right p-3 font-medium">目前號碼</th>
                    <th className="text-right p-3 font-medium">起訖</th>
                    <th className="text-left p-3 font-medium">狀態</th>
                    <th className="p-3 text-right w-48">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((seq) => (
                    <tr key={seq.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-mono font-medium">{seq.track_prefix}</td>
                      <td className="p-3">{seq.year_month}</td>
                      <td className="p-3 text-right font-mono">{seq.current_number}</td>
                      <td className="p-3 text-right text-muted-foreground">
                        {seq.start_number}～{seq.end_number}
                      </td>
                      <td className="p-3">
                        <Badge variant={seq.is_active ? 'success' : 'secondary'}>
                          {seq.is_active ? '啟用中' : '停用'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(seq)}
                          >
                            {seq.is_active ? '停用' : '啟用'}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(seq)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openDelete(seq)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新增 Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增字軌</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">字軌前綴</Label>
              <Input
                className="col-span-3"
                placeholder="例：AB"
                value={form.track_prefix}
                onChange={(e) => setForm((f) => ({ ...f, track_prefix: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">期別</Label>
              <Input
                className="col-span-3"
                placeholder="例：11501（114年1-2月）"
                value={form.year_month}
                onChange={(e) => setForm((f) => ({ ...f, year_month: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">起始號碼</Label>
              <Input
                type="number"
                min={1}
                className="col-span-3"
                value={form.start_number}
                onChange={(e) => setForm((f) => ({ ...f, start_number: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">結束號碼</Label>
              <Input
                type="number"
                min={1}
                className="col-span-3"
                value={form.end_number}
                onChange={(e) => setForm((f) => ({ ...f, end_number: parseInt(e.target.value, 10) || 99999999 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAdd} disabled={submitLoading}>
              {submitLoading ? '處理中…' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯字軌</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">字軌前綴</Label>
              <Input
                className="col-span-3"
                value={form.track_prefix}
                onChange={(e) => setForm((f) => ({ ...f, track_prefix: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">期別</Label>
              <Input
                className="col-span-3"
                value={form.year_month}
                onChange={(e) => setForm((f) => ({ ...f, year_month: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">起始號碼</Label>
              <Input
                type="number"
                min={1}
                className="col-span-3"
                value={form.start_number}
                onChange={(e) => setForm((f) => ({ ...f, start_number: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">結束號碼</Label>
              <Input
                type="number"
                min={1}
                className="col-span-3"
                value={form.end_number}
                onChange={(e) => setForm((f) => ({ ...f, end_number: parseInt(e.target.value, 10) || 99999999 }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-2">
              <Label className="col-span-1">目前號碼</Label>
              <Input
                type="number"
                min={form.start_number}
                max={form.end_number}
                className="col-span-3"
                value={form.current_number ?? form.start_number}
                onChange={(e) => setForm((f) => ({ ...f, current_number: parseInt(e.target.value, 10) || f.start_number }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEdit} disabled={submitLoading}>
              {submitLoading ? '處理中…' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="刪除字軌"
        description={
          target
            ? `確定要刪除字軌「${target.track_prefix}」嗎？若此字軌已開立過發票則無法刪除。`
            : undefined
        }
        confirmLabel="刪除"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteLoading}
      />
    </div>
  );
}
