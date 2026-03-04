/**
 * 新增消息頁面
 */

import { Newspaper } from 'lucide-react';
import { getNewsCategories } from '@/app/actions/news-categories';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { NewsEditor } from '@/components/news/NewsEditor';

export const dynamic = 'force-dynamic';

export default async function NewNewsPage() {
  let categories: any[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      categories = await getNewsCategories().catch(() => []);
    }
  } catch (error) {
    console.error('Failed to load data:', error);
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Newspaper}
          title="請先登入"
          description="登入後即可管理最新消息"
        />
      </div>
    );
  }

  return <NewsEditor categories={categories} />;
}
