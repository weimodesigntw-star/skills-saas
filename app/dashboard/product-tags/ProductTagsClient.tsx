'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, X, Loader2, Trash2 } from 'lucide-react';
import {
  createProductTag,
  deleteProductTag,
  updateProductTag,
  type ProductTag,
} from '@/app/actions/product-tags';
import {
  PRODUCT_TAG_DIMENSIONS,
  type ProductTagManageDimension,
} from '@/lib/constants/product-tags';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type ProductTagsClientProps = {
  initialTags: ProductTag[];
};

function groupByDimension(tags: ProductTag[]): Record<string, ProductTag[]> {
  const g: Record<string, ProductTag[]> = {};
  for (const d of PRODUCT_TAG_DIMENSIONS) {
    g[d] = [];
  }
  for (const t of tags) {
    if (!g[t.dimension]) g[t.dimension] = [];
    g[t.dimension].push(t);
  }
  for (const d of Object.keys(g)) {
    g[d].sort((a, b) => a.sort_order - b.sort_order);
  }
  return g;
}

export function ProductTagsClient({ initialTags }: ProductTagsClientProps) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTags(initialTags);
  }, [initialTags]);

  const grouped = useMemo(() => groupByDimension(tags), [tags]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#6b7280');

  const [addingFor, setAddingFor] = useState<ProductTagManageDimension | null>(null);
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState('#3b82f6');

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [forceDelete, setForceDelete] = useState<{ id: string; name: string; count: number } | null>(
    null
  );

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function startEdit(t: ProductTag) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditColor(t.color);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(tagId: string) {
    const res = await updateProductTag(tagId, editName, editColor);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('已更新標籤');
    setEditingId(null);
    refresh();
  }

  async function submitAdd(dimension: ProductTagManageDimension) {
    const res = await createProductTag(addName, addColor, dimension);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('已新增標籤');
    setAddingFor(null);
    setAddName('');
    setAddColor('#3b82f6');
    refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setDeleteTarget(null);

    const res = await deleteProductTag(id);
    if (res.success) {
      toast.success(`已刪除「${name}」`);
      refresh();
      return;
    }
    if (res.usageCount !== undefined && res.usageCount > 0) {
      setForceDelete({ id, name, count: res.usageCount });
      return;
    }
    if (res.error) toast.error(res.error);
  }

  async function confirmForceDelete() {
    if (!forceDelete) return;
    const { id, name } = forceDelete;
    setForceDelete(null);

    const res = await deleteProductTag(id, { force: true });
    if (res.success) {
      toast.success(`已強制刪除「${name}」並自商品移除關聯`);
      refresh();
    } else if (res.error) {
      toast.error(res.error);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6 space-y-10">
          {PRODUCT_TAG_DIMENSIONS.map((dim) => (
            <section key={dim}>
              <div className="flex items-center justify-between gap-4 mb-3">
                <h2 className="text-lg font-semibold">{dim}</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setAddingFor(dim);
                    setAddName('');
                    setAddColor('#3b82f6');
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  加入
                </Button>
              </div>

              {addingFor === dim && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
                  <div className="flex-1 min-w-[140px]">
                    <label className="text-xs text-muted-foreground">名稱</label>
                    <Input
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                      placeholder="新標籤名稱"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">顏色</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={addColor}
                        onChange={(e) => setAddColor(e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border border-input bg-background"
                      />
                      <Input
                        value={addColor}
                        onChange={(e) => setAddColor(e.target.value)}
                        className="w-28 font-mono text-sm"
                        placeholder="#hex"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={isPending || !addName.trim()}
                    onClick={() => submitAdd(dim)}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : '建立'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAddingFor(null)}>
                    取消
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {grouped[dim]?.length === 0 && addingFor !== dim ? (
                  <p className="text-sm text-muted-foreground">尚無標籤，可點「加入」新增。</p>
                ) : null}
                {grouped[dim]?.map((t) => (
                  <div key={t.id} className="inline-flex flex-col gap-2">
                    {editingId === t.id ? (
                      <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-background p-3 shadow-sm">
                        <div className="flex-1 min-w-[160px]">
                          <label className="text-xs text-muted-foreground">名稱</label>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">顏色</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="h-10 w-14 cursor-pointer rounded border"
                            />
                            <Input
                              value={editColor}
                              onChange={(e) => setEditColor(e.target.value)}
                              className="w-28 font-mono text-sm"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending || !editName.trim()}
                          onClick={() => saveEdit(t.id)}
                        >
                          儲存
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                          取消
                        </Button>
                      </div>
                    ) : (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
                          'bg-background hover:bg-muted/50 transition-colors'
                        )}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: t.color }}
                        />
                        <span>{t.name}</span>
                        <button
                          type="button"
                          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground"
                          title="編輯"
                          onClick={() => startEdit(t)}
                          disabled={isPending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                          title="刪除"
                          onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                          disabled={isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>

      {/* 層二：未使用 — 簡單確認 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>刪除標籤</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deleteTarget?.name}」嗎？若仍有商品使用此標籤，將改為提示強制刪除選項。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2 inline" />
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 有使用時：強制刪除 */}
      <AlertDialog open={!!forceDelete} onOpenChange={(o) => !o && setForceDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>無法直接刪除</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  「{forceDelete?.name}」標籤目前被 <strong>{forceDelete?.count}</strong> 個商品使用。
                </p>
                <p>
                  刪除前請先至商品管理移除這些商品的此標籤，或使用「強制刪除」（將同步從所有商品移除此標籤）。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmForceDelete();
              }}
            >
              強制刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
