'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, ImageIcon, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createGallery, updateGallery, deleteGallery, type Gallery } from '@/app/actions/galleries';

interface GalleryManagerProps {
  initialGalleries: Gallery[];
}

export function GalleryManager({ initialGalleries }: GalleryManagerProps) {
  const [galleries, setGalleries] = useState<Gallery[]>(initialGalleries);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Gallery | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function openCreate() {
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setDialogOpen(true);
  }

  function openEdit(item: Gallery, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description || '');
    setDialogOpen(true);
  }

  function handleSave() {
    const formData = new FormData();
    formData.set('title', title);
    formData.set('description', description);

    startTransition(async () => {
      try {
        if (editingItem) {
          const updated = await updateGallery(editingItem.id, formData);
          setGalleries((prev) => prev.map((g) => (g.id === updated.id ? { ...updated, photo_count: editingItem.photo_count } : g)));
        } else {
          const created = await createGallery(formData);
          setGalleries((prev) => [{ ...created, photo_count: 0 }, ...prev]);
        }
        setDialogOpen(false);
      } catch (error: any) {
        alert(error.message || '操作失敗');
      }
    });
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('確定要刪除這個照片集嗎？所有照片也會一起刪除。')) return;

    startTransition(async () => {
      try {
        await deleteGallery(id);
        setGalleries((prev) => prev.filter((g) => g.id !== id));
      } catch (error: any) {
        alert(error.message || '刪除失敗');
      }
    });
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">照片集</h1>
            <p className="text-muted-foreground mt-2">
              管理照片集和相簿
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            新增照片集
          </Button>
        </div>
      </div>

      {galleries.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="還沒有照片集"
          description="建立第一個照片集來開始"
          action={<Button onClick={openCreate}>新增照片集</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleries.map((gallery) => (
            <Link
              key={gallery.id}
              href={`/dashboard/galleries/${gallery.id}`}
              className="group"
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                {/* Cover Image */}
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {gallery.cover_image_url ? (
                    <Image
                      src={gallery.cover_image_url}
                      alt={gallery.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{gallery.title}</h3>
                      {gallery.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {gallery.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {gallery.photo_count || 0} 張照片
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => openEdit(gallery, e)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(gallery.id, e)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '編輯照片集' : '新增照片集'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="gallery-title">標題 *</Label>
              <Input
                id="gallery-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="輸入照片集標題"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="gallery-desc">描述</Label>
              <Textarea
                id="gallery-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="輸入照片集描述"
                rows={3}
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button onClick={handleSave} disabled={isPending || !title.trim()}>
                {isPending ? '儲存中...' : editingItem ? '更新' : '建立'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
