/**
 * Products List Page
 *
 * Displays all products for the current user in a table format with
 * search, filtering, and pagination capabilities.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Plus, Package, ArrowDown, ArrowUp } from 'lucide-react';
import { getProducts } from '@/app/actions/products';
import { fetchPosCategories } from '@/app/actions/pos';
import { Button } from '@/components/ui/button';
import { ImportDialog } from '@/components/import/ImportDialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { createServerClient } from '@/lib/supabase/server';
import { formatNTD } from '@/lib/constants';
import { SyncProductsButton } from './SyncProductsButton';

export const dynamic = 'force-dynamic';

const PRODUCT_SORT = ['name', 'price', 'stock', 'created_at'] as const;
type ProductSortKey = (typeof PRODUCT_SORT)[number];

interface ProductsPageProps {
  searchParams: {
    q?: string;
    page?: string;
    category?: string;
    sort?: string;
    dir?: string;
  };
}

function productsListHref(opts: {
  q?: string;
  page?: number;
  category?: string | null;
  sort?: string | null;
  dir?: string | null;
}) {
  const p = new URLSearchParams();
  if (opts.q?.trim()) p.set('q', opts.q.trim());
  if (opts.page && opts.page > 1) p.set('page', String(opts.page));
  if (opts.category) p.set('category', opts.category);
  if (opts.sort) p.set('sort', opts.sort);
  if (opts.dir) p.set('dir', opts.dir);
  const s = p.toString();
  return s ? `/dashboard/products?${s}` : '/dashboard/products';
}

/**
 * Format date to locale string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Get status badge for product
 */
function getStatusBadge(isActive: boolean, stock: number, lowThreshold: number) {
  if (!isActive) {
    return <Badge variant="outline">已停用</Badge>;
  }
  if (stock < lowThreshold) {
    return <Badge variant="destructive">低庫存</Badge>;
  }
  return <Badge variant="default">正常</Badge>;
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
  const sortCol = PRODUCT_SORT.includes(searchParams.sort as ProductSortKey)
    ? (searchParams.sort as ProductSortKey)
    : 'created_at';
  const sortDirection = searchParams.dir === 'asc' ? 'asc' : 'desc';
  let productCategories: { id: string; name: string }[] = [];

  function productSortHref(column: ProductSortKey) {
    const active = sortCol === column;
    const nextDir = active
      ? sortDirection === 'asc'
        ? 'desc'
        : 'asc'
      : column === 'name'
        ? 'asc'
        : 'desc';
    return productsListHref({
      q: search,
      page: 1,
      category: categoryId ?? null,
      sort: column,
      dir: nextDir,
    });
  }

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

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
        <EmptyState
          icon={Package}
          title="請先登入"
          description="登入後即可管理商品"
        />
      ) : products.length === 0 && !search ? (
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
        <>
          {/* Search Bar + F-001 分類 tabs */}
          <div className="mb-6 space-y-4">
            <form className="flex gap-2" action="/dashboard/products" method="GET">
              {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
              <input type="hidden" name="sort" value={sortCol} />
              <input type="hidden" name="dir" value={sortDirection} />
              <Input
                type="text"
                name="q"
                placeholder="搜尋商品名稱、條碼或 SKU..."
                defaultValue={search}
                className="flex-1"
              />
              <Button type="submit" variant="outline">
                搜尋
              </Button>
            </form>
            {productCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground mr-1">分類</span>
                <Button variant={!categoryId ? 'default' : 'outline'} size="sm" asChild>
                  <Link
                    href={productsListHref({
                      q: search,
                      page: 1,
                      category: null,
                      sort: sortCol,
                      dir: sortDirection,
                    })}
                  >
                    全部
                  </Link>
                </Button>
                {productCategories.map((c) => (
                  <Button
                    key={c.id}
                    variant={categoryId === c.id ? 'default' : 'outline'}
                    size="sm"
                    asChild
                  >
                    <Link
                      href={productsListHref({
                        q: search,
                        page: 1,
                        category: c.id,
                        sort: sortCol,
                        dir: sortDirection,
                      })}
                    >
                      {c.name}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {products.length === 0 && search ? (
            <EmptyState
              icon={Package}
              title="未找到商品"
              description={`沒有符合「${search}」的商品`}
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-semibold text-sm w-16">圖片</th>
                        <th className="text-left p-4 font-semibold text-sm">
                          <Link
                            href={productSortHref('name')}
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                          >
                            商品名稱
                            {sortCol === 'name' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </Link>
                        </th>
                        <th className="text-left p-4 font-semibold text-sm">條碼</th>
                        <th className="text-left p-4 font-semibold text-sm">
                          <Link
                            href={productSortHref('price')}
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                          >
                            單價
                            {sortCol === 'price' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </Link>
                        </th>
                        <th className="text-left p-4 font-semibold text-sm">
                          <Link
                            href={productSortHref('stock')}
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                          >
                            庫存
                            {sortCol === 'stock' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </Link>
                        </th>
                        <th className="text-left p-4 font-semibold text-sm">分類</th>
                        <th className="text-left p-4 font-semibold text-sm">狀態</th>
                        <th className="text-left p-4 font-semibold text-sm whitespace-nowrap">
                          <Link
                            href={productSortHref('created_at')}
                            className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                          >
                            建立
                            {sortCol === 'created_at' ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5" />
                              )
                            ) : null}
                          </Link>
                        </th>
                        <th className="text-right p-4 font-semibold text-sm">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product: any) => (
                        <tr
                          key={product.id}
                          className="border-b hover:bg-muted/50 transition-colors"
                        >
                          {/* Image */}
                          <td className="p-4">
                            {product.image_url ? (
                              <div className="relative w-10 h-10 rounded border border-input overflow-hidden bg-muted">
                                <Image
                                  src={product.image_url}
                                  alt={product.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded border border-input bg-muted flex items-center justify-center">
                                <Package className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                          </td>

                          {/* Name */}
                          <td className="p-4">
                            <Link
                              href={`/dashboard/products/${product.id}`}
                              className="font-medium hover:underline text-primary"
                            >
                              {product.name}
                            </Link>
                            {product.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                {product.description}
                              </p>
                            )}
                          </td>

                          {/* Barcode */}
                          <td className="p-4 text-sm font-mono">
                            {product.barcode || '-'}
                          </td>

                          {/* Price */}
                          <td className="p-4 text-sm font-medium">
                            {formatNTD(product.price)}
                          </td>

                          {/* Stock */}
                          <td className="p-4 text-sm">
                            <span
                              className={
                                product.stock < product.low_stock_threshold
                                  ? 'text-destructive font-medium'
                                  : ''
                              }
                            >
                              {product.stock}
                            </span>
                          </td>

                          {/* Category */}
                          <td className="p-4 text-sm">
                            {product.categories?.name || '-'}
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            {getStatusBadge(
                              product.is_active,
                              product.stock,
                              product.low_stock_threshold
                            )}
                          </td>

                          <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(product.created_at)}
                          </td>

                          {/* Actions */}
                          <td className="p-4 text-right">
                            <Link href={`/dashboard/products/${product.id}`}>
                              <Button variant="ghost" size="sm">
                                編輯
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2 flex-wrap">
              {currentPage > 1 && (
                <Link
                  href={productsListHref({
                    q: search,
                    page: currentPage - 1,
                    category: categoryId ?? null,
                    sort: sortCol,
                    dir: sortDirection,
                  })}
                >
                  <Button variant="outline">上一頁</Button>
                </Link>
              )}

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Link
                  key={page}
                  href={productsListHref({
                    q: search,
                    page,
                    category: categoryId ?? null,
                    sort: sortCol,
                    dir: sortDirection,
                  })}
                >
                  <Button
                    variant={page === currentPage ? 'default' : 'outline'}
                    size="sm"
                  >
                    {page}
                  </Button>
                </Link>
              ))}

              {currentPage < totalPages && (
                <Link
                  href={productsListHref({
                    q: search,
                    page: currentPage + 1,
                    category: categoryId ?? null,
                    sort: sortCol,
                    dir: sortDirection,
                  })}
                >
                  <Button variant="outline">下一頁</Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
