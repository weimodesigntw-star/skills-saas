/**
 * Extract video platform and embed ID from URL
 */
export function parseVideoUrl(url: string): { platform: string; embedId: string | null } {
  if (!url) return { platform: 'custom', embedId: null };

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return { platform: 'youtube', embedId: ytMatch[1] };

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch) return { platform: 'vimeo', embedId: vimeoMatch[1] };

  return { platform: 'custom', embedId: null };
}

/**
 * Get YouTube thumbnail URL from video ID
 */
export function getYouTubeThumbnail(embedId: string): string {
  return `https://img.youtube.com/vi/${embedId}/hqdefault.jpg`;
}
