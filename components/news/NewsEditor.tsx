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
  Sparkles,
  Eye,
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
  createNews,
  updateNews,
  deleteNews,
  searchNews,
  addRelatedNews,
  removeRelatedNews,
  uploadContentBlockImage,
  type NewsArticle,
  type ContentBlock,
} from '@/app/actions/news';
import {
  createNewsCategory,
  updateNewsCategory,
  type NewsCategory,
} from '@/app/actions/news-categories';
import { ContentBlockEditor } from './ContentBlockEditor';

interface NewsEditorProps {
  article?: NewsArticle | null;
  categories: NewsCategory[];
  relatedNews?: Array<{
    id: string;
    title: string;
    category_name?: string | null;
    published_at?: string | null;
  }>;
}

export function NewsEditor({ article, categories: initialCategories, relatedNews: initialRelated }: NewsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!article;

  // Categories state
  const [categories, setCategories] = useState(initialCategories);

  // Form state
  const [title, setTitle] = useState(article?.title || '');
  const [summary, setSummary] = useState(article?.summary || '');
  const [content, setContent] = useState(article?.content || '');
  const [categoryId, setCategoryId] = useState(article?.category_id || '');
  const [isPublished, setIsPublished] = useState(article?.is_published ?? false);
  const [isPinned, setIsPinned] = useState(article?.is_pinned ?? false);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>(
    article?.content_blocks || []
  );

  // Cover image
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(article?.cover_image_url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Related news
  const [relatedItems, setRelatedItems] = useState(initialRelated || []);
  const [relatedSearchQuery, setRelatedSearchQuery] = useState('');
  const [relatedSearchResults, setRelatedSearchResults] = useState<any[]>([]);
  const [isSearchingRelated, setIsSearchingRelated] = useState(false);

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<NewsCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');

  // Image handling
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('圖片大小不能超過 5MB');
      return;
    }
    setImageFile(file);
    setRemoveImage(false);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleRemoveImage() {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true);
  }

  // Save handler
  function handleSave() {
    if (!title.trim()) {
      alert('標題不能為空');
      return;
    }

    const formData = new FormData();
    formData.set('title', title);
    formData.set('content', content);
    formData.set('summary', summary);
    formData.set('is_published', isPublished.toString());
    formData.set('is_pinned', isPinned.toString());
    formData.set('category_id', categoryId);
    formData.set('content_blocks', JSON.stringify(contentBlocks));
    if (imageFile) {
      formData.set('cover_image', imageFile);
    }
    if (removeImage) {
      formData.set('remove_image', 'true');
    }

    startTransition(async () => {
      try {
        if (isEditing && article) {
          await updateNews(article.id, formData);
          router.refresh();
        } else {
          const created = await createNews(formData);
          router.replace(`/dashboard/news/${created.id}`);
        }
      } catch (error: any) {
        alert(error.message || '操作失敗');
      }
    });
  }

  // Delete handler
  function handleDelete() {
    if (!article) return;
    if (!confirm('確定要刪除這則消息嗎？')) return;

    startTransition(async () => {
      try {
        await deleteNews(article.id);
        router.replace('/dashboard/news');
      } catch (error: any) {
        alert(error.message || '刪除失敗');
      }
    });
  }

  // Block image upload handler
  async function handleBlockImageUpload(file: File): Promise<string> {
    if (!article) {
      throw new Error('請先儲存消息後再上傳區塊圖片');
    }
    return uploadContentBlockImage(article.id, file);
  }

  // Related news search
  async function handleSearchRelated() {
    if (!relatedSearchQuery.trim()) return;
    setIsSearchingRelated(true);
    try {
      const results = await searchNews(relatedSearchQuery, article?.id);
      setRelatedSearchResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingRelated(false);
    }
  }

  async function handleAddRelated(relatedId: string, relatedTitle: string, catName?: string) {
    if (!article) return;
    try {
      await addRelatedNews(article.id, relatedId);
      setRelatedItems((prev) => [...prev, { id: relatedId, title: relatedTitle, category_name: catName }]);
      setRelatedSearchResults((prev) => prev.filter((r) => r.id !== relatedId));
    } catch (err: any) {
      alert(err.message || '添加失敗');
    }
  }

  async function handleRemoveRelated(relatedId: string) {
    if (!article) return;
    try {
      await removeRelatedNews(article.id, relatedId);
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
        const updated = await updateNewsCategory(editingCategory.id, categoryName);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await createNewsCategory(categoryName);
        setCategories((prev) => [...prev, created]);
        setCategoryId(created.id);
      }
      setCategoryDialogOpen(false);
    } catch (err: any) {
      alert(err.message || '操作失敗');
    }
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/news')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">消息編輯</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isPending ? '儲存中...' : '儲存'}
          </Button>
          {isEditing && article?.is_published && (
            <Button variant="outline" asChild>
              <Link href={`/news/${article.id}`} target="_blank">
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
            刪除消息
          </button>
          <span className="text-sm text-muted-foreground">
            編輯於：{new Date(article!.updated_at).toLocaleString('zh-TW')}
          </span>
        </div>
      )}

      {/* Main Layout: Content (left) + Sidebar (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">消息基本資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Title */}
              <div>
                <Label htmlFor="news-title">
                  消息標題 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="news-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="輸入消息標題"
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
                <Label htmlFor="news-summary">消息摘要</Label>
                <Textarea
                  id="news-summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="輸入消息摘要，將顯示在列表頁面"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Featured Image Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">特色圖片</CardTitle>
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
                      alt="封面預覽"
                      width={600}
                      height={400}
                      className="rounded-lg object-contain w-full"
                      unoptimized
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 rounded-full bg-destructive/90 text-destructive-foreground p-1.5 hover:bg-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
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
                    點擊上傳特色圖片
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    支援 JPG、PNG、WebP（最大 5MB）
                  </span>
                </button>
              )}
            </CardContent>
          </Card>

          {/* Content Blocks Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">消息內容</CardTitle>
            </CardHeader>
            <CardContent>
              <ContentBlockEditor
                blocks={contentBlocks}
                onChange={setContentBlocks}
                onImageUpload={isEditing ? handleBlockImageUpload : undefined}
              />
              {!isEditing && contentBlocks.some((b) => b.type === 'image') && (
                <p className="text-sm text-amber-600 mt-3">
                  提示：圖片段落需先儲存消息後才能上傳圖片
                </p>
              )}
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

          {/* News Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">消息設定</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">置頂消息</span>
              </label>
            </CardContent>
          </Card>

          {/* Related News (only show when editing) */}
          {isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">相關消息</CardTitle>
                <p className="text-sm text-muted-foreground">
                  選擇與此消息相關的其他消息，提升用戶閱讀體驗
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Search */}
                <div className="flex gap-2">
                  <Input
                    value={relatedSearchQuery}
                    onChange={(e) => setRelatedSearchQuery(e.target.value)}
                    placeholder="搜尋相關消息.."
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

                {/* Selected Related News */}
                {relatedItems.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-muted-foreground">已選擇的相關消息</p>
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
                placeholder="例如：品牌活動"
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
