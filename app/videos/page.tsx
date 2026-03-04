import Link from 'next/link';
import Image from 'next/image';
import { Play, Star, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPublishedVideosList } from '@/app/actions/videos-public';

export const dynamic = 'force-dynamic';

export default async function PublicVideosPage() {
  const videos = await getPublishedVideosList();

  if (videos.length === 0) {
    return (
      <div className="container mx-auto py-16 px-4 text-center">
        <Play className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">影片專區</h1>
        <p className="text-muted-foreground">目前還沒有影片</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">影片專區</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={`/videos/${video.id}`}
            className="group block rounded-xl overflow-hidden border bg-card hover:shadow-lg transition-all duration-200"
          >
            {/* Thumbnail */}
            <div className="relative aspect-video bg-muted">
              {video.thumbnail_url ? (
                <Image
                  src={video.thumbnail_url}
                  alt={video.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                  unoptimized
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Play className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="h-6 w-6 text-white ml-0.5" />
                </div>
              </div>
              {/* Duration badge */}
              {video.duration && (
                <span className="absolute bottom-2 right-2 bg-black/75 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {video.duration}
                </span>
              )}
              {/* Featured badge */}
              {video.is_featured && (
                <span className="absolute top-2 left-2">
                  <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                    <Star className="h-3 w-3 mr-1 fill-white" />
                    精選
                  </Badge>
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-4">
              <h2 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
                {video.title}
              </h2>
              {video.summary && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {video.summary}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3">
                {video.category_name && (
                  <Badge variant="secondary" className="text-xs">
                    {video.category_name}
                  </Badge>
                )}
                {video.published_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(video.published_at).toLocaleDateString('zh-TW')}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
