import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Star, Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPublishedVideoById } from '@/app/actions/videos-public';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

function getEmbedUrl(platform: string, embedId: string | null): string | null {
  if (!embedId) return null;
  if (platform === 'youtube') return `https://www.youtube.com/embed/${embedId}?rel=0`;
  if (platform === 'vimeo') return `https://player.vimeo.com/video/${embedId}`;
  return null;
}

export default async function PublicVideoDetailPage({ params }: PageProps) {
  const video = await getPublishedVideoById(params.id);

  if (!video) {
    notFound();
  }

  const embedUrl = getEmbedUrl(video.video_platform, video.video_embed_id);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back link */}
      <Link
        href="/videos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回影片列表
      </Link>

      {/* Video Player */}
      {embedUrl ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black mb-6">
          <iframe
            src={embedUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      ) : video.video_url ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted mb-6 flex items-center justify-center">
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Play className="h-16 w-16" />
            <span className="text-sm">點擊觀看影片</span>
          </a>
        </div>
      ) : null}

      {/* Title & Meta */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold mb-3">{video.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {video.category_name && (
            <Badge variant="secondary">{video.category_name}</Badge>
          )}
          {video.is_featured && (
            <Badge className="bg-amber-500 text-white hover:bg-amber-500">
              <Star className="h-3 w-3 mr-1 fill-white" />
              精選
            </Badge>
          )}
          {video.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {video.duration}
            </span>
          )}
          {video.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(video.published_at).toLocaleDateString('zh-TW', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Summary */}
      {video.summary && (
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-muted-foreground">{video.summary}</p>
        </div>
      )}

      {/* Description */}
      {video.description && (
        <div className="prose prose-neutral max-w-none">
          {video.description.split('\n').map((paragraph, idx) => (
            paragraph.trim() ? (
              <p key={idx}>{paragraph}</p>
            ) : (
              <br key={idx} />
            )
          ))}
        </div>
      )}
    </div>
  );
}
