/**
 * 前台最新消息列表頁面（公開）
 */

import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ArrowLeft, Pin, ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPublishedNewsList } from '@/app/actions/news-public';

export const dynamic = 'force-dynamic';

export default async function PublicNewsPage() {
  const news = await getPublishedNewsList();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-slate-900">Skills SaaS</span>
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              回首頁
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <h1 className="text-4xl font-bold text-slate-900">最新消息</h1>
        <p className="text-lg text-slate-600 mt-2">
          了解我們的最新動態和公告
        </p>
      </div>

      {/* News List */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {news.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 text-lg">目前沒有消息</p>
          </div>
        ) : (
          <div className="space-y-6">
            {news.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="block group"
              >
                <article className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all duration-200">
                  <div className="flex flex-col sm:flex-row">
                    {/* Cover Image */}
                    <div className="sm:w-64 sm:shrink-0 h-48 sm:h-auto bg-slate-100 relative overflow-hidden">
                      {item.cover_image_url ? (
                        <Image
                          src={item.cover_image_url}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <ImageIcon className="w-12 h-12 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6">
                      <div className="flex items-center gap-2 mb-2">
                        {item.is_pinned && (
                          <Badge variant="secondary" className="text-amber-700 bg-amber-50">
                            <Pin className="w-3 h-3 mr-1" />
                            置頂
                          </Badge>
                        )}
                        {item.category_name && (
                          <Badge variant="outline" className="text-indigo-600 border-indigo-200">
                            {item.category_name}
                          </Badge>
                        )}
                      </div>

                      <h2 className="text-xl font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors mb-2">
                        {item.title}
                      </h2>

                      {item.summary && (
                        <p className="text-slate-600 line-clamp-2 mb-3">
                          {item.summary}
                        </p>
                      )}

                      {item.published_at && (
                        <time className="text-sm text-slate-400">
                          {new Date(item.published_at).toLocaleDateString('zh-TW', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </time>
                      )}
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-slate-500 text-sm">
          <p>&copy; 2026 Skills SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
