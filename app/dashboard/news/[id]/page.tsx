/**
 * 編輯消息頁面
 */

import { notFound } from 'next/navigation';
import { Newspaper } from 'lucide-react';
import { getNewsById, getRelatedNews } from '@/app/actions/news';
import { getNewsCategories } from '@/app/actions/news-categories';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { NewsEditor } from '@/components/news/NewsEditor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function EditNewsPage({ params }: PageProps) {
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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

    isAuthenticated = true;

    const [article, categories, relatedNews] = await Promise.all([
      getNewsById(params.id),
      getNewsCategories().catch(() => []),
      getRelatedNews(params.id).catch(() => []),
    ]);

    return (
      <NewsEditor
        article={article}
        categories={categories}
        relatedNews={relatedNews}
      />
    );
  } catch (error: any) {
    if (error.message === 'News not found') {
      notFound();
    }

    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Newspaper}
          title="載入失敗"
          description={error.message || '無法載入消息'}
        />
      </div>
    );
  }
}
