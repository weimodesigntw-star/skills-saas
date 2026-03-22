/**
 * Products List Page
 */

import Link from 'next/link';
import { Plus, Package } from 'lucide-react';
import { getProducts } from '@/app/actions/products';
import { fetchPosCategories } from '@/app/actions/pos';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/ImportDialog';
import { EmptyState } from '@/components/ui/empty-state';
import { createServerClient } from '@/lib/supabase/server';
import { SyncProductsButton } from './SyncProductsButton';
import {
  ProductsListClient,
  type ProductSortKey,
  type ProductStatusFilterKey,
} from './ProductsListClient';

export const dynamic = 'force-dynamic';

const PRODUCT_SORT = ['name', 'price', 'stock', 'created_at'] as const;
const PRODUCT_STATUS_FILTERS = ['active', 'inactive', 'low_stock'] as const;

interface ProductsPageProps {
  searchParams: {
    q?: string;
    page?: string;
    category?: string;
    sort?: string;
    dir?: string;
    productStatus?: string;
  };
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  let products: any[] = [];
  let isAuthenticated = false;
  let totalPages = 0;
  let currentPage = 1;
  let lastSyncedAt: string | null = null;
  let lastSyncedCount: number | null = null;
  const search = searchParams.q || '';
  const pageParam = searchParams.page ? parseInt(searchParams.page) : 1;
  const categoryId = searchParams.category || undefined;
  const productStatusFilter = PRODUCT_STATUS_FILTERS.includes(
    searchParams.productStatus as ProductStatusFilterKey
  )
    ? (searchParams.productStatus as ProductStatusFilterKey)
    : undefined;
  const sortCol = PRODUCT_SORT.includes(searchParams.sort as ProductSortKey)
    ? (searchParams.sort as ProductSortKey)
    : 'created_at';
  const sortDirection = searchParams.dir === 'asc' ? 'asc' : 'desc';
  let productCategories: { id: string; name: string }[] = [];

  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      productCategories = await fetchPosCategories();

      const result = await getProducts({
        page: pageParam,
        limit: 20,
        search: search || undefined,
        categoryId,
        sortBy: sortCol,
        sortDir: sortDirection,
        productStatus: productStatusFilter,
      });

      products = result.products;
      totalPages = result.totalPages;
      currentPage = result.page;

      const { data: syncState } = await supabase
        .from('easystore_sync_state')
        .select('last_synced_at,synced_count')
        .eq('user_id', user.id)
        .eq('resource', 'products')
        .maybeSingle();
      lastSyncedAt = (syncState?.last_synced_at as string | null) ?? null;
      lastSyncedCount = (syncState?.synced_count as number | null) ?? null;
    }
  } catch (error) {
    console.error('Failed to load products:', error);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">商品管理</h1>
            <p className="text-muted-foreground mt-2">
              建立和管理商品庫存，支援圖片上傳和多種稅務類型
            </p>
          </div>
          <div className="flex gap-2">
            <SyncProductsButton lastSyncedAt={lastSyncedAt} lastSyncedCount={lastSyncedCount} />
            <ImportDialog type="products" />
            <Link href="/dashboard/products/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增商品
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {!isAuthenticated ? (
        <EmptyState icon={Package} title="請先登入" description="登入後即可管理商品" />
      ) : products.length === 0 && !search && !categoryId && !productStatusFilter ? (
        <EmptyState
          icon={Package}
          title="還沒有商品"
          description="建立第一個商品來開始"
          action={
            <Link href="/dashboard/products/new">
              <Button>建立新商品</Button>
            </Link>
          }
        />
      ) : (
        <ProductsListClient
          products={products}
          totalPages={totalPages}
          currentPage={currentPage}
          search={search}
          categoryId={categoryId}
          productStatusFilter={productStatusFilter}
          sortCol={sortCol}
          sortDirection={sortDirection}
          productCategories={productCategories}
        />
      )}
    </div>
  );
}
