/**
 * 照片集詳情頁面 - 管理照片
 */

import { ImageIcon } from 'lucide-react';
import { getGalleryWithPhotos } from '@/app/actions/galleries';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { GalleryDetail } from '@/components/gallery/GalleryDetail';

export const dynamic = 'force-dynamic';

interface GalleryDetailPageProps {
  params: { id: string };
}

export default async function GalleryDetailPage({ params }: GalleryDetailPageProps) {
  let gallery: any = null;
  let photos: any[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      const result = await getGalleryWithPhotos(params.id);
      gallery = result.gallery;
      photos = result.photos;
    }
  } catch (error) {
    console.error('Failed to load gallery:', error);
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={ImageIcon}
          title="請先登入"
          description="登入後即可管理照片集"
        />
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={ImageIcon}
          title="找不到照片集"
          description="照片集不存在或您沒有權限檢視"
        />
      </div>
    );
  }

  return <GalleryDetail gallery={gallery} initialPhotos={photos} />;
}
