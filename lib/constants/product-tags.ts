/** 標籤維度（與 DB / 種子一致） */
export const PRODUCT_TAG_DIMENSIONS = ['品項', '工藝', '染色', '素材', '系列'] as const;
export type ProductTagManageDimension = (typeof PRODUCT_TAG_DIMENSIONS)[number];

export function isProductTagDimension(d: string): d is ProductTagManageDimension {
  return (PRODUCT_TAG_DIMENSIONS as readonly string[]).includes(d);
}
