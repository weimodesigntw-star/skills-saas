import { Video } from 'lucide-react';
import { getVideoCategories } from '@/app/actions/video-categories';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { VideoEditor } from '@/components/videos/VideoEditor';

export const dynamic = 'force-dynamic';

export default async function NewVideoPage() {
  let categories: any[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      categories = await getVideoCategories().catch(() => []);
    }
  } catch (error) {
    console.error('Failed to load data:', error);
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

  return <VideoEditor categories={categories} />;
}
