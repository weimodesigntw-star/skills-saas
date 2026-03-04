/**
 * 照片集管理頁面
 */

import { ImageIcon } from 'lucide-react';
import { getGalleries } from '@/app/actions/galleries';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { GalleryManager } from '@/components/gallery/GalleryManager';

export const dynamic = 'force-dynamic';

export default async function GalleriesPage() {
  let galleries: any[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      galleries = await getGalleries();
    }
  } catch (error) {
    console.error('Failed to load galleries:', error);
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

  return <GalleryManager initialGalleries={galleries} />;
}
