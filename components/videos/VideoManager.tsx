'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Video,
  Pencil,
  Trash2,
  Search,
  Star,
  Eye,
  Play,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { deleteVideo, type Video as VideoType } from '@/app/actions/videos';
import type { VideoCategory } from '@/app/actions/video-categories';

interface VideoManagerProps {
  initialVideos: VideoType[];
  categories: VideoCategory[];
}

export function VideoManager({ initialVideos, categories }: VideoManagerProps) {
  const router = useRouter();
  const [videos, setVideos] = useState<VideoType[]>(initialVideos);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filtered videos
  const filteredVideos = useMemo(() => {
    return videos.filter((item) => {
      if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterCategory !== 'all' && item.category_id !== filterCategory) {
        return false;
      }
      if (filterStatus === 'published' && !item.is_published) return false;
      if (filterStatus === 'draft' && item.is_published) return false;
      return true;
    });
  }, [videos, searchQuery, filterCategory, filterStatus]);

  function handleDelete(id: string) {
    if (!confirm('確定要刪除這部影片嗎？')) return;

    startTransition(async () => {
      try {
        await deleteVideo(id);
        setVideos((prev) => prev.filter((v) => v.id !== id));
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

  function getPlatformLabel(platform: string): string {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'vimeo': return 'Vimeo';
      default: return '自訂';
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">影片管理</h1>
            <p className="text-muted-foreground mt-1">
              共 {filteredVideos.length} 部
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/videos" target="_blank">
                <Eye className="h-4 w-4 mr-2" />
                查看前台
              </Link>
            </Button>
            <Button onClick={() => router.push('/dashboard/videos/new')}>
              <Plus className="h-4 w-4 mr-2" />
              新增影片
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋影片標題..."
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

      {/* Video Table */}
      {filteredVideos.length === 0 ? (
        videos.length === 0 ? (
          <EmptyState
            icon={Video}
            title="還沒有影片"
            description="新增第一部影片"
            action={
              <Button onClick={() => router.push('/dashboard/videos/new')}>
                新增影片
              </Button>
            }
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              找不到符合條件的影片
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
                    <th className="text-left p-4 font-semibold text-sm">影片</th>
                    <th className="text-left p-4 font-semibold text-sm">分類</th>
                    <th className="text-left p-4 font-semibold text-sm">平台</th>
                    <th className="text-left p-4 font-semibold text-sm">狀態</th>
                    <th className="text-left p-4 font-semibold text-sm">精選</th>
                    <th className="text-left p-4 font-semibold text-sm">最後編輯</th>
                    <th className="text-right p-4 font-semibold text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVideos.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/videos/${item.id}`)}
                    >
                      {/* Title with thumbnail */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {item.thumbnail_url && (
                            <div className="relative w-20 h-12 rounded overflow-hidden bg-muted shrink-0">
                              <Image
                                src={item.thumbnail_url}
                                alt={item.title}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                <Play className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-xs">
                              {item.title}
                            </div>
                            {item.duration && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {item.duration}
                              </span>
                            )}
                          </div>
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
                      {/* Platform */}
                      <td className="p-4 text-sm">
                        <Badge variant="outline" className="font-normal">
                          {getPlatformLabel(item.video_platform)}
                        </Badge>
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
                      {/* Featured */}
                      <td className="p-4 text-sm">
                        {item.is_featured ? (
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
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
                            onClick={() => router.push(`/dashboard/videos/${item.id}`)}
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
