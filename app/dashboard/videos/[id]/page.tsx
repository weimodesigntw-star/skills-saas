import { notFound } from 'next/navigation';
import { Video } from 'lucide-react';
import { getVideoById, getRelatedVideos } from '@/app/actions/videos';
import { getVideoCategories } from '@/app/actions/video-categories';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { VideoEditor } from '@/components/videos/VideoEditor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function EditVideoPage({ params }: PageProps) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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

    const [video, categories, relatedVideos] = await Promise.all([
      getVideoById(params.id),
      getVideoCategories().catch(() => []),
      getRelatedVideos(params.id).catch(() => []),
    ]);

    return (
      <VideoEditor
        video={video}
        categories={categories}
        relatedVideos={relatedVideos}
      />
    );
  } catch (error: any) {
    if (error.message === 'Video not found') {
      notFound();
    }

    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Video}
          title="載入失敗"
          description={error.message || '無法載入影片'}
        />
      </div>
    );
  }
}
