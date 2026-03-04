'use client';

import React, { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  Upload,
  X,
  Plus,
  Pencil,
  Search,
  Eye,
  Play,
  Clock,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createVideo,
  updateVideo,
  deleteVideo,
  searchVideos,
  addRelatedVideo,
  removeRelatedVideo,
  type Video,
} from '@/app/actions/videos';
import { parseVideoUrl, getYouTubeThumbnail } from '@/lib/video-utils';
import {
  createVideoCategory,
  updateVideoCategory,
  type VideoCategory,
} from '@/app/actions/video-categories';

interface VideoEditorProps {
  video?: Video | null;
  categories: VideoCategory[];
  relatedVideos?: Array<{
    id: string;
    title: string;
    category_name?: string | null;
    published_at?: string | null;
  }>;
}

export function VideoEditor({ video, categories: initialCategories, relatedVideos: initialRelated }: VideoEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!video;

  // Categories state
  const [categories, setCategories] = useState(initialCategories);

  // Form state
  const [title, setTitle] = useState(video?.title || '');
  const [summary, setSummary] = useState(video?.summary || '');
  const [description, setDescription] = useState(video?.description || '');
  const [videoUrl, setVideoUrl] = useState(video?.video_url || '');
  const [duration, setDuration] = useState(video?.duration || '');
  const [categoryId, setCategoryId] = useState(video?.category_id || '');
  const [isPublished, setIsPublished] = useState(video?.is_published ?? false);
  const [isFeatured, setIsFeatured] = useState(video?.is_featured ?? false);

  // Thumbnail
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(video?.thumbnail_url || null);
  const [removeThumbnail, setRemoveThumbnail] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Related videos
  const [relatedItems, setRelatedItems] = useState(initialRelated || []);
  const [relatedSearchQuery, setRelatedSearchQuery] = useState('');
  const [relatedSearchResults, setRelatedSearchResults] = useState<any[]>([]);
  const [isSearchingRelated, setIsSearchingRelated] = useState(false);

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<VideoCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Video preview state
  const videoParsed = parseVideoUrl(videoUrl);

  // Image handling
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不能超過 5MB');
      return;
    }
    setImageFile(file);
    setRemoveThumbnail(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemoveThumbnail() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveThumbnail(true);
  }

  // Auto-detect thumbnail from video URL
  function handleVideoUrlBlur() {
    if (!imageFile && !imagePreview && videoUrl) {
      const { platform, embedId } = parseVideoUrl(videoUrl);
      if (platform === 'youtube' && embedId) {
        setImagePreview(getYouTubeThumbnail(embedId));
        setRemoveThumbnail(false);
      }
    }
  }

  // Save handler
  function handleSave() {
    if (!title.trim()) {
      alert('標題不能為空');
      return;
    }

    const formData = new FormData();
    formData.set('title', title);
    formData.set('description', description);
    formData.set('summary', summary);
    formData.set('video_url', videoUrl);
    formData.set('duration', duration);
    formData.set('is_published', isPublished.toString());
    formData.set('is_featured', isFeatured.toString());
    formData.set('category_id', categoryId);
    if (imageFile) {
      formData.set('thumbnail', imageFile);
    }
    if (removeThumbnail) {
      formData.set('remove_thumbnail', 'true');
    }

    startTransition(async () => {
      try {
        if (isEditing && video) {
          await updateVideo(video.id, formData);
          router.refresh();
        } else {
          const created = await createVideo(formData);
          router.replace(`/dashboard/videos/${created.id}`);
        }
      } catch (error: any) {
        alert(error.message || '操作失敗');
      }
    });
  }

  // Delete handler
  function handleDelete() {
    if (!video) return;
    if (!confirm('確定要刪除這部影片嗎？')) return;

    startTransition(async () => {
      try {
        await deleteVideo(video.id);
        router.replace('/dashboard/videos');
      } catch (error: any) {
        alert(error.message || '刪除失敗');
      }
    });
  }

  // Related video search
  async function handleSearchRelated() {
    if (!relatedSearchQuery.trim()) return;
    setIsSearchingRelated(true);
    try {
      const results = await searchVideos(relatedSearchQuery, video?.id);
      setRelatedSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingRelated(false);
    }
  }

  async function handleAddRelated(relatedId: string, relatedTitle: string, catName?: string) {
    if (!video) return;
    try {
      await addRelatedVideo(video.id, relatedId);
      setRelatedItems((prev) => [...prev, { id: relatedId, title: relatedTitle, category_name: catName }]);
      setRelatedSearchResults((prev) => prev.filter((r) => r.id !== relatedId));
    } catch (err: any) {
      alert(err.message || '添加失敗');
    }
  }

  async function handleRemoveRelated(relatedId: string) {
    if (!video) return;
    try {
      await removeRelatedVideo(video.id, relatedId);
      setRelatedItems((prev) => prev.filter((r) => r.id !== relatedId));
    } catch (err: any) {
      alert(err.message || '移除失敗');
    }
  }

  // Category management
  function openAddCategory() {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryDialogOpen(true);
  }

  function openEditCategory() {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryDialogOpen(true);
  }

  async function handleSaveCategory() {
    if (!categoryName.trim()) return;
    try {
      if (editingCategory) {
        const updated = await updateVideoCategory(editingCategory.id, categoryName);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createVideoCategory(categoryName);
        setCategories((prev) => [...prev, created]);
        setCategoryId(created.id);
      }
      setCategoryDialogOpen(false);
    } catch (err: any) {
      alert(err.message || '操作失敗');
    }
  }

  // Render video embed preview
  function renderVideoPreview() {
    if (!videoUrl) return null;
    const { platform, embedId } = parseVideoUrl(videoUrl);

    if (platform === 'youtube' && embedId) {
      return (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${embedId}`}
            title="YouTube video preview"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      );
    }

    if (platform === 'vimeo' && embedId) {
      return (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
          <iframe
            src={`https://player.vimeo.com/video/${embedId}`}
            title="Vimeo video preview"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      );
    }

    if (videoUrl) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/50 text-sm text-muted-foreground">
          <LinkIcon className="h-4 w-4 shrink-0" />
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
            {videoUrl}
          </a>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/videos')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">影片編輯</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isPending ? '儲存中...' : '儲存'}
          </Button>
          {isEditing && video?.is_published && (
            <Button variant="outline" asChild>
              <Link href={`/videos/${video.id}`} target="_blank">
                <Eye className="h-4 w-4 mr-2" />
                查看前台
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Delete & Last Edit Info */}
      {isEditing && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            刪除影片
          </button>
          <span className="text-sm text-muted-foreground">
            編輯於：{new Date(video!.updated_at).toLocaleString('zh-TW')}
          </span>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">影片基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="video-title">
                  影片標題 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="video-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="輸入影片標題"
                  className="mt-1.5"
                />
              </div>

              {/* Category */}
              <div>
                <Label>分類</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">選擇分類</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={openAddCategory}
                    title="新增分類"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {categoryId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 p-0"
                      onClick={openEditCategory}
                      title="編輯分類"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div>
                <Label htmlFor="video-summary">影片摘要</Label>
                <Textarea
                  id="video-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="輸入影片摘要，將顯示在列表頁面"
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Video URL Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Play className="h-5 w-5" />
                影片連結
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="video-url">
                  影片網址
                </Label>
                <Input
                  id="video-url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onBlur={handleVideoUrlBlur}
                  placeholder="貼上 YouTube 或 Vimeo 連結，例如 https://www.youtube.com/watch?v=..."
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  支援 YouTube、Vimeo 連結，系統會自動辨識並嵌入播放器
                </p>
              </div>

              {/* Duration */}
              <div>
                <Label htmlFor="video-duration" className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  影片時長
                </Label>
                <Input
                  id="video-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="例如 12:34"
                  className="mt-1.5 max-w-xs"
                />
              </div>

              {/* Video preview */}
              {videoUrl && (
                <div>
                  <Label className="mb-2 block">影片預覽</Label>
                  {renderVideoPreview()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Thumbnail Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">影片縮圖</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative inline-block">
                  <div className="relative max-w-lg">
                    <Image
                      src={imagePreview}
                      alt="縮圖預覽"
                      width={600}
                      height={340}
                      className="rounded-lg object-contain w-full"
                      unoptimized
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveThumbnail}
                    className="absolute top-2 right-2 rounded-full bg-destructive/90 text-destructive-foreground p-1.5 hover:bg-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 rounded-md bg-background/90 text-foreground px-2 py-1 text-xs hover:bg-background transition-colors border"
                  >
                    更換縮圖
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center w-full max-w-lg h-48 rounded-lg border-2 border-dashed border-input bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    點擊上傳縮圖
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    支援 JPG、PNG、WebP（最大 5MB）
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">
                    YouTube 影片會自動擷取縮圖
                  </span>
                </button>
              )}
            </CardContent>
          </Card>

          {/* Description Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">影片說明</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="輸入影片的詳細說明..."
                rows={6}
                className="w-full"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* Publish Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">發布設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="publish-status"
                  checked={isPublished}
                  onChange={() => setIsPublished(true)}
                  className="h-4 w-4"
                />
                <span className="text-sm">立即發布</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="publish-status"
                  checked={!isPublished}
                  onChange={() => setIsPublished(false)}
                  className="h-4 w-4"
                />
                <span className="text-sm">儲存為草稿</span>
              </label>
            </CardContent>
          </Card>

          {/* Video Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">影片設定</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">精選影片</span>
              </label>
            </CardContent>
          </Card>

          {/* Related Videos (only show when editing) */}
          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">相關影片</CardTitle>
                <p className="text-sm text-muted-foreground">
                  選擇與此影片相關的其他影片，提升用戶觀看體驗
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Search */}
                <div className="flex gap-2">
                  <Input
                    value={relatedSearchQuery}
                    onChange={(e) => setRelatedSearchQuery(e.target.value)}
                    placeholder="搜尋相關影片.."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchRelated();
                    }}
                  />
                  <Button
                    variant="default"
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={handleSearchRelated}
                    disabled={isSearchingRelated}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {/* Search Results */}
                {relatedSearchResults.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">搜尋結果</p>
                    {relatedSearchResults.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-2 rounded-md border bg-muted/30 text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.title}</div>
                          {item.category_name && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {item.category_name}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          className="ml-2 h-7 text-xs shrink-0"
                          onClick={() => handleAddRelated(item.id, item.title, item.category_name)}
                        >
                          + 添加
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Selected Related Videos */}
                {relatedItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">已選擇的相關影片</p>
                    {relatedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-2 rounded-md border text-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{item.title}</div>
                          {item.category_name && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              {item.category_name}
                            </Badge>
                          )}
                        </div>
                        <button
                          onClick={() => handleRemoveRelated(item.id)}
                          className="ml-2 p-1 text-destructive hover:bg-destructive/10 rounded-full shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? '編輯分類' : '新增分類'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="cat-name">分類名稱</Label>
              <Input
                id="cat-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="例如：教學影片"
                className="mt-1.5"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSaveCategory} disabled={!categoryName.trim()}>
                {editingCategory ? '更新' : '建立'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
