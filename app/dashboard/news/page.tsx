/**
 * 最新消息管理頁面 - 列表
 */

import { Newspaper } from 'lucide-react';
import { getNewsList } from '@/app/actions/news';
import { getNewsCategories } from '@/app/actions/news-categories';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { NewsManager } from '@/components/news/NewsManager';

export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  let news: any[] = [];
  let categories: any[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      [news, categories] = await Promise.all([
        getNewsList(),
        getNewsCategories().catch(() => []),
      ]);
    }
  } catch (error) {
    console.error('Failed to load news:', error);
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

  return <NewsManager initialNews={news} categories={categories} />;
}
