import { Video } from 'lucide-react';
import { getVideosList } from '@/app/actions/videos';
import { getVideoCategories } from '@/app/actions/video-categories';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { VideoManager } from '@/components/videos/VideoManager';

export const dynamic = 'force-dynamic';

export default async function VideosPage() {
  let videos: any[] = [];
  let categories: any[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      [videos, categories] = await Promise.all([
        getVideosList(),
        getVideoCategories().catch(() => []),
      ]);
    }
  } catch (error) {
    console.error('Failed to load videos:', error);
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Video}
          title="請先登入"
          description="登入後即可管理影片"
        />
      </div>
    );
  }

  return <VideoManager initialVideos={videos} categories={categories} />;
}
