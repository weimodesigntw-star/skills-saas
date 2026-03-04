'use client';

import React, { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Plus, Trash2, ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { uploadGalleryPhoto, deleteGalleryPhoto, type Gallery, type GalleryPhoto } from '@/app/actions/galleries';

interface GalleryDetailProps {
  gallery: Gallery;
  initialPhotos: GalleryPhoto[];
}

export function GalleryDetail({ gallery, initialPhotos }: GalleryDetailProps) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>(initialPhotos);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }

  function openUpload() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCaption('');
    setUploadOpen(true);
  }

  function handleUpload() {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.set('image', selectedFile);
    formData.set('caption', caption);

    startTransition(async () => {
      try {
        const photo = await uploadGalleryPhoto(gallery.id, formData);
        setPhotos((prev) => [photo, ...prev]);
        setUploadOpen(false);
      } catch (error: any) {
        alert(error.message || '上傳失敗');
      }
    });
  }

  function handleDeletePhoto(photoId: string) {
    if (!confirm('確定要刪除這張照片嗎？')) return;

    startTransition(async () => {
      try {
        await deleteGalleryPhoto(photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      } catch (error: any) {
        alert(error.message || '刪除失敗');
      }
    });
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Link
          href="/dashboard/galleries"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回照片集
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{gallery.title}</h1>
            {gallery.description && (
              <p className="text-muted-foreground mt-2">{gallery.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              共 {photos.length} 張照片
            </p>
          </div>
          <Button onClick={openUpload}>
            <Upload className="h-4 w-4 mr-2" />
            上傳照片
          </Button>
        </div>
      </div>

      {photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="還沒有照片"
          description="上傳第一張照片"
          action={<Button onClick={openUpload}>上傳照片</Button>}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo, index) => (
            <Card key={photo.id} className="overflow-hidden group relative">
              <div
                className="aspect-square relative cursor-pointer"
                onClick={() => setLightboxIndex(index)}
              >
                <Image
                  src={photo.image_url}
                  alt={photo.caption || '照片'}
                  fill
                  className="object-cover"
                />
              </div>
              {/* Overlay actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeletePhoto(photo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {photo.caption && (
                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {photo.caption}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>上傳照片</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="photo-file">選擇圖片 *</Label>
              <div className="mt-1.5">
                <Input
                  id="photo-file"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>
              {previewUrl && (
                <div className="mt-3 relative aspect-video w-full overflow-hidden rounded-lg border">
                  <Image
                    src={previewUrl}
                    alt="預覽"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="photo-caption">說明（選填）</Label>
              <Input
                id="photo-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="輸入照片說明"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setUploadOpen(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button onClick={handleUpload} disabled={isPending || !selectedFile}>
                {isPending ? '上傳中...' : '上傳'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Dialog open={true} onOpenChange={() => setLightboxIndex(null)}>
          <DialogContent className="sm:max-w-4xl p-0 bg-black/95 border-none">
            <div className="relative w-full aspect-[4/3]">
              <Image
                src={photos[lightboxIndex].image_url}
                alt={photos[lightboxIndex].caption || '照片'}
                fill
                className="object-contain"
              />
            </div>
            {photos[lightboxIndex].caption && (
              <p className="text-white text-center py-3 px-4 text-sm">
                {photos[lightboxIndex].caption}
              </p>
            )}
            {/* Navigation */}
            <div className="absolute inset-y-0 left-0 flex items-center">
              {lightboxIndex > 0 && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-full rounded-none px-4"
                  onClick={() => setLightboxIndex(lightboxIndex - 1)}
                >
                  ‹
                </Button>
              )}
            </div>
            <div className="absolute inset-y-0 right-0 flex items-center">
              {lightboxIndex < photos.length - 1 && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/20 h-full rounded-none px-4"
                  onClick={() => setLightboxIndex(lightboxIndex + 1)}
                >
                  ›
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
