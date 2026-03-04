'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus,
  Newspaper,
  Pencil,
  Trash2,
  Search,
  Pin,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { deleteNews, type NewsArticle } from '@/app/actions/news';
import type { NewsCategory } from '@/app/actions/news-categories';

interface NewsManagerProps {
  initialNews: NewsArticle[];
  categories: NewsCategory[];
}

export function NewsManager({ initialNews, categories }: NewsManagerProps) {
  const router = useRouter();
  const [news, setNews] = useState<NewsArticle[]>(initialNews);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filtered news
  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      // Search filter
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Category filter
      if (filterCategory !== 'all' && item.category_id !== filterCategory) {
        return false;
      }
      // Status filter
      if (filterStatus === 'published' && !item.is_published) return false;
      if (filterStatus === 'draft' && item.is_published) return false;
      return true;
    });
  }, [news, searchQuery, filterCategory, filterStatus]);

  function handleDelete(id: string) {
    if (!confirm('確定要刪除這則消息嗎？')) return;

    startTransition(async () => {
      try {
        await deleteNews(id);
        setNews((prev) => prev.filter((n) => n.id !== id));
      } catch (error: any) {
        alert(error.message || '刪除失敗');
      }
    });
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">消息列表</h1>
            <p className="text-muted-foreground mt-1">
              共 {filteredNews.length} 筆
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/news" target="_blank">
                <Eye className="h-4 w-4 mr-2" />
                查看前台
              </Link>
            </Button>
            <Button onClick={() => router.push('/dashboard/news/new')}>
              <Plus className="h-4 w-4 mr-2" />
              新增消息
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋消息標題..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全部分類</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全部狀態</option>
            <option value="published">已發布</option>
            <option value="draft">草稿</option>
          </select>
        </div>
      </div>

      {/* News Table */}
      {filteredNews.length === 0 ? (
        news.length === 0 ? (
          <EmptyState
            icon={Newspaper}
            title="還沒有消息"
            description="建立第一則最新消息"
            action={
              <Button onClick={() => router.push('/dashboard/news/new')}>
                新增消息
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              找不到符合條件的消息
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-4 font-semibold text-sm">標題</th>
                    <th className="text-left p-4 font-semibold text-sm">分類</th>
                    <th className="text-left p-4 font-semibold text-sm">狀態</th>
                    <th className="text-left p-4 font-semibold text-sm">置頂</th>
                    <th className="text-left p-4 font-semibold text-sm">最後編輯</th>
                    <th className="text-right p-4 font-semibold text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNews.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/news/${item.id}`)}
                    >
                      {/* Title */}
                      <td className="p-4">
                        <div className="font-medium max-w-md">
                          {item.title}
                        </div>
                      </td>
                      {/* Category */}
                      <td className="p-4 text-sm">
                        {item.category_name ? (
                          <Badge variant="secondary" className="font-normal">
                            {item.category_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="p-4">
                        {item.is_published ? (
                          <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            已發布
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            草稿
                          </Badge>
                        )}
                      </td>
                      {/* Pinned */}
                      <td className="p-4 text-sm">
                        {item.is_pinned ? (
                          <Pin className="h-4 w-4 text-amber-500" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      {/* Last Edit Date */}
                      <td className="p-4 text-sm whitespace-nowrap">
                        {formatDate(item.updated_at)}
                      </td>
                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-primary hover:bg-primary/10"
                            onClick={() => router.push(`/dashboard/news/${item.id}`)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(item.id)}
                            disabled={isPending}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
