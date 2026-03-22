import { listProductTags } from '@/app/actions/product-tags';
import { ProductTagsClient } from './ProductTagsClient';

export const dynamic = 'force-dynamic';

export default async function ProductTagsPage() {
  const tags = await listProductTags();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">標籤管理</h1>
        <p className="text-muted-foreground mt-2">
          管理商品標籤，可依工藝、染色、素材、系列等維度分類；與「分類管理」同屬商品屬性設定。
        </p>
      </div>
      <ProductTagsClient initialTags={tags} />
    </div>
  );
}
