/**
 * 前台消息詳細頁面（公開）
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles, ArrowLeft, Pin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPublishedNewsById } from '@/app/actions/news-public';
import type { ContentBlock } from '@/app/actions/news';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

function renderContentBlock(block: ContentBlock) {
  if (block.type === 'text') {
    return (
      <div
        key={block.id}
        className="prose prose-slate max-w-none prose-lg"
        dangerouslySetInnerHTML={{ __html: block.content || '' }}
      />
    );
  }

  if (block.type === 'image' && block.imageUrl) {
    const alignClass =
      block.align === 'left'
        ? 'text-left'
        : block.align === 'right'
          ? 'text-right'
          : 'text-center';

    return (
      <figure key={block.id} className={`my-6 ${alignClass}`}>
        <Image
          src={block.imageUrl}
          alt={block.caption || ''}
          width={800}
          height={600}
          className="rounded-lg inline-block"
          style={block.maxWidth ? { maxWidth: `${block.maxWidth}px` } : undefined}
          unoptimized
        />
        {block.caption && (
          <figcaption className="mt-2 text-sm text-slate-500 italic">
            {block.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return null;
}

export default async function PublicNewsDetailPage({ params }: PageProps) {
  const article = await getPublishedNewsById(params.id);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-slate-900">Skills SaaS</span>
            </Link>
            <Link
              href="/news"
              className="flex items-center gap-1 text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回消息列表
            </Link>
          </div>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Meta */}
        <div className="flex items-center gap-2 mb-4">
          {article.is_pinned && (
            <Badge variant="secondary" className="text-amber-700 bg-amber-50">
              <Pin className="w-3 h-3 mr-1" />
              置頂
            </Badge>
          )}
          {article.category_name && (
            <Badge variant="outline" className="text-indigo-600 border-indigo-200">
              {article.category_name}
            </Badge>
          )}
          {article.published_at && (
            <time className="text-sm text-slate-400">
              {new Date(article.published_at).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
          {article.title}
        </h1>

        {/* Summary */}
        {article.summary && (
          <p className="text-xl text-slate-600 leading-relaxed mb-8 border-l-4 border-indigo-200 pl-4">
            {article.summary}
          </p>
        )}

        {/* Cover Image */}
        {article.cover_image_url && (
          <div className="relative w-full aspect-video rounded-xl overflow-hidden mb-10">
            <Image
              src={article.cover_image_url}
              alt={article.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Content Blocks */}
        {article.content_blocks && article.content_blocks.length > 0 ? (
          <div className="space-y-6">
            {article.content_blocks.map(renderContentBlock)}
          </div>
        ) : article.content ? (
          <div className="prose prose-slate prose-lg max-w-none whitespace-pre-wrap">
            {article.content}
          </div>
        ) : null}
      </article>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-slate-500 text-sm">
          <p>&copy; 2026 Skills SaaS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
