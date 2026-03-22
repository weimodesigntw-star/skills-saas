/**
 * 從 EasyStore Product JSON 取出「第一張圖」URL。
 * 官方欄位可能為 images[].src / images[].url，或單一 image 物件／字串。
 * @see https://developers.easystore.co/docs/api
 */

function isHttpish(s: string): boolean {
  const t = s.trim();
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('//')
  );
}

function normalizeUrl(s: string): string {
  const t = s.trim();
  if (t.startsWith('//')) return `https:${t}`;
  return t;
}

/** 從單一 image 節點（物件或字串）取 URL */
function pickFromImageNode(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === 'string' && isHttpish(node)) return normalizeUrl(node);
  if (typeof node !== 'object') return null;
  const o = node as Record<string, unknown>;
  const keys = ['src', 'url', 'src_large', 'src_medium', 'original_src', 'src_https', 'permalink'];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && isHttpish(v)) return normalizeUrl(v);
  }
  return null;
}

export function extractEasyStoreProductImageUrl(p: Record<string, any>): string | null {
  const images = p.images;
  if (Array.isArray(images) && images.length > 0) {
    const u = pickFromImageNode(images[0]);
    if (u) return u;
  }

  const uImg = pickFromImageNode(p.image);
  if (uImg) return uImg;

  const variants: any[] = p.variants ?? [];
  const v0 = variants[0];
  if (v0) {
    const fromV = pickFromImageNode(v0.image) ?? pickFromImageNode(v0.featured_image);
    if (fromV) return fromV;
  }

  const roots = [p.featured_image, p.featured_image_url, p.image_url, p.image_src];
  for (const r of roots) {
    if (typeof r === 'string' && isHttpish(r)) return normalizeUrl(r);
  }

  return null;
}
