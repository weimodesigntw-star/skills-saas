'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { formatNTD } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { batchUpdateProductStatus } from '@/app/actions/products';
import type { ProductTag } from '@/app/actions/product-tags';
import { toast } from '@/components/ui/toast';

const PRODUCT_SORT = ['name', 'price', 'stock', 'created_at'] as const;
export type ProductSortKey = (typeof PRODUCT_SORT)[number];

const PRODUCT_STATUS_FILTERS = ['active', 'inactive', 'low_stock'] as const;
export type ProductStatusFilterKey = (typeof PRODUCT_STATUS_FILTERS)[number];

export type ProductTagChipRow = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

export type ProductRow = {
  id: string;
  name: string;
  description?: string | null;
  barcode?: string | null;
  price: number;
  stock: number;
  low_stock_threshold: number;
  image_url?: string | null;
  is_active: boolean;
  created_at: string;
  categories?: { name: string } | null;
  /** INT-C：列表標籤 chips */
  tagChips?: ProductTagChipRow[];
  physical_stock?: number;
  reserved_stock?: number;
  channel_stock_easystore?: number;
  available_stock?: number;
};

function productsListHref(opts: {
  q?: string;
  page?: number;
  category?: string | null;
  sort?: string | null;
  dir?: string | null;
  productStatus?: string | null;
  /** INT-B：篩選同時擁有這些標籤的商品（AND） */
  tags?: string[] | null;
}) {
  const p = new URLSearchParams();
  if (opts.q?.trim()) p.set('q', opts.q.trim());
  if (opts.page && opts.page > 1) p.set('page', String(opts.page));
  if (opts.category) p.set('category', opts.category);
  if (opts.sort) p.set('sort', opts.sort);
  if (opts.dir) p.set('dir', opts.dir);
  if (opts.productStatus) p.set('productStatus', opts.productStatus);
  if (opts.tags?.length) p.set('tags', opts.tags.join(','));
  const s = p.toString();
  return s ? `/dashboard/products?${s}` : '/dashboard/products';
}

function ProductSortHeaderLink({
  column,
  label,
  sortCol,
  sortDirection,
  href,
  thClassName,
}: {
  column: ProductSortKey;
  label: string;
  sortCol: ProductSortKey;
  sortDirection: 'asc' | 'desc';
  href: string;
  thClassName?: string;
}) {
  const active = sortCol === column;
  return (
    <th className={cn('text-left p-4 font-semibold text-sm', thClassName)}>
      <Link
        href={href}
        className="inline-flex items-center gap-1 hover:text-primary hover:underline"
        aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {label}
        {active ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-80" aria-hidden />
        )}
      </Link>
    </th>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getStatusBadge(isActive: boolean, stock: number, lowThreshold: number) {
  if (!isActive) {
    return <Badge variant="outline">已停用</Badge>;
  }
  if (stock === 0) {
    return (
      <Badge variant="outline" className="border-red-600 text-red-600">
        缺貨
      </Badge>
    );
  }
  if (stock < lowThreshold) {
    return <Badge variant="destructive">低庫存</Badge>;
  }
  return <Badge variant="default">正常</Badge>;
}

interface ProductsListClientProps {
  products: ProductRow[];
  totalPages: number;
  currentPage: number;
  search: string;
  categoryId?: string;
  productStatusFilter?: ProductStatusFilterKey;
  sortCol: ProductSortKey;
  sortDirection: 'asc' | 'desc';
  productCategories: { id: string; name: string }[];
  /** 目前 URL ?tags= 篩選 */
  tagIdsFilter?: string[];
  /** 可點選篩選的全部標籤 */
  allTagsForFilter?: ProductTag[];
}

export function ProductsListClient({
  products,
  totalPages,
  currentPage,
  search,
  categoryId,
  productStatusFilter,
  sortCol,
  sortDirection,
  productCategories,
  tagIdsFilter = [],
  allTagsForFilter = [],
}: ProductsListClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const allIds = useMemo(() => products.map((p) => p.id), [products]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(allIds));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const tagsForHref = tagIdsFilter.length ? tagIdsFilter : null;

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
      productStatus: productStatusFilter ?? null,
      tags: tagsForHref,
    });
  }

  function toggleTagInFilter(tagId: string): string {
    const set = new Set(tagIdsFilter);
    if (set.has(tagId)) set.delete(tagId);
    else set.add(tagId);
    const next = [...set];
    return productsListHref({
      q: search,
      page: 1,
      category: categoryId ?? null,
      sort: sortCol,
      dir: sortDirection,
      productStatus: productStatusFilter ?? null,
      tags: next.length ? next : null,
    });
  }

  async function runBatch(isActive: boolean) {
    const ids = [...selected];
    if (!ids.length) return;
    setBatchLoading(true);
    const res = await batchUpdateProductStatus(ids, isActive);
    setBatchLoading(false);
    if ('error' in res && res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(isActive ? '已批次上架' : '已批次下架');
    setSelected(new Set());
    router.refresh();
  }

  return (
    <>
      {someSelected && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium">已選 {selected.size} 筆</span>
          <Button size="sm" variant="default" disabled={batchLoading} onClick={() => runBatch(true)}>
            批次上架
          </Button>
          <Button size="sm" variant="secondary" disabled={batchLoading} onClick={() => runBatch(false)}>
            批次下架
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            取消
          </Button>
        </div>
      )}

      <div className="mb-6 space-y-4">
        <form className="flex gap-2 flex-wrap" action="/dashboard/products" method="GET">
          {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
          {productStatusFilter ? <input type="hidden" name="productStatus" value={productStatusFilter} /> : null}
          {tagIdsFilter.length > 0 ? <input type="hidden" name="tags" value={tagIdsFilter.join(',')} /> : null}
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
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground mr-1">狀態</span>
          <Button variant={!productStatusFilter ? 'default' : 'outline'} size="sm" asChild>
            <Link
              href={productsListHref({
                q: search,
                page: 1,
                category: categoryId ?? null,
                sort: sortCol,
                dir: sortDirection,
                productStatus: null,
                tags: tagsForHref,
              })}
            >
              全部
            </Link>
          </Button>
          <Button variant={productStatusFilter === 'active' ? 'default' : 'outline'} size="sm" asChild>
            <Link
              href={productsListHref({
                q: search,
                page: 1,
                category: categoryId ?? null,
                sort: sortCol,
                dir: sortDirection,
                productStatus: 'active',
                tags: tagsForHref,
              })}
            >
              上架中
            </Link>
          </Button>
          <Button variant={productStatusFilter === 'inactive' ? 'default' : 'outline'} size="sm" asChild>
            <Link
              href={productsListHref({
                q: search,
                page: 1,
                category: categoryId ?? null,
                sort: sortCol,
                dir: sortDirection,
                productStatus: 'inactive',
                tags: tagsForHref,
              })}
            >
              已下架
            </Link>
          </Button>
          <Button variant={productStatusFilter === 'low_stock' ? 'default' : 'outline'} size="sm" asChild>
            <Link
              href={productsListHref({
                q: search,
                page: 1,
                category: categoryId ?? null,
                sort: sortCol,
                dir: sortDirection,
                productStatus: 'low_stock',
                tags: tagsForHref,
              })}
            >
              低庫存
            </Link>
          </Button>
        </div>
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
                  productStatus: productStatusFilter ?? null,
                  tags: tagsForHref,
                })}
              >
                全部
              </Link>
            </Button>
            {productCategories.map((c) => (
              <Button key={c.id} variant={categoryId === c.id ? 'default' : 'outline'} size="sm" asChild>
                <Link
                  href={productsListHref({
                    q: search,
                    page: 1,
                    category: c.id,
                    sort: sortCol,
                    dir: sortDirection,
                    productStatus: productStatusFilter ?? null,
                    tags: tagsForHref,
                  })}
                >
                  {c.name}
                </Link>
              </Button>
            ))}
          </div>
        )}
        {allTagsForFilter.length > 0 && (
          <div className="flex flex-wrap gap-2 items-start">
            <span className="text-sm text-muted-foreground mr-1 shrink-0 pt-1.5">標籤</span>
            <div className="flex flex-wrap gap-2 flex-1 items-center">
              {tagIdsFilter.length > 0 && (
                <Button variant="secondary" size="sm" asChild>
                  <Link
                    href={productsListHref({
                      q: search,
                      page: 1,
                      category: categoryId ?? null,
                      sort: sortCol,
                      dir: sortDirection,
                      productStatus: productStatusFilter ?? null,
                      tags: null,
                    })}
                  >
                    清除標籤
                  </Link>
                </Button>
              )}
              {allTagsForFilter.map((t) => {
                const active = tagIdsFilter.includes(t.id);
                return (
                  <Button key={t.id} variant={active ? 'default' : 'outline'} size="sm" asChild>
                    <Link href={toggleTagInFilter(t.id)} className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full border border-black/10"
                        style={{ backgroundColor: t.color }}
                        aria-hidden
                      />
                      {t.name}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {products.length === 0 && !search && (categoryId || productStatusFilter || tagIdsFilter.length > 0) ? (
        <EmptyState
          icon={Package}
          title="沒有符合條件的商品"
          description="請調整分類、標籤、狀態篩選或搜尋關鍵字"
        />
      ) : products.length === 0 && search ? (
        <EmptyState icon={Package} title="未找到商品" description={`沒有符合「${search}」的商品`} />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="w-10 p-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={allSelected}
                        onChange={(e) => toggleAll(e.target.checked)}
                        aria-label="全選此頁"
                      />
                    </th>
                    <th className="text-left p-4 font-semibold text-sm w-16">圖片</th>
                    <ProductSortHeaderLink
                      column="name"
                      label="商品名稱"
                      sortCol={sortCol}
                      sortDirection={sortDirection}
                      href={productSortHref('name')}
                    />
                    <th className="text-left p-4 font-semibold text-sm">條碼</th>
                    <ProductSortHeaderLink
                      column="price"
                      label="單價"
                      sortCol={sortCol}
                      sortDirection={sortDirection}
                      href={productSortHref('price')}
                    />
                    <ProductSortHeaderLink
                      column="stock"
                      label="庫存 (實/可/留/通)"
                      sortCol={sortCol}
                      sortDirection={sortDirection}
                      href={productSortHref('stock')}
                      thClassName="min-w-[140px]"
                    />
                    <th className="text-left p-4 font-semibold text-sm">分類</th>
                    <th className="text-left p-4 font-semibold text-sm min-w-[140px]">標籤</th>
                    <th className="text-left p-4 font-semibold text-sm">狀態</th>
                    <ProductSortHeaderLink
                      column="created_at"
                      label="建立"
                      sortCol={sortCol}
                      sortDirection={sortDirection}
                      href={productSortHref('created_at')}
                      thClassName="whitespace-nowrap"
                    />
                    <th className="text-right p-4 font-semibold text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 align-middle">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input"
                          checked={selected.has(product.id)}
                          onChange={(e) => toggleOne(product.id, e.target.checked)}
                          aria-label={`選取 ${product.name}`}
                        />
                      </td>
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
                      <td className="p-4">
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {product.name}
                        </Link>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{product.description}</p>
                        )}
                      </td>
                      <td className="p-4 text-sm font-mono">{product.barcode || '-'}</td>
                      <td className="p-4 text-sm font-medium">{formatNTD(product.price)}</td>
                      <td className="p-4 text-sm">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-2 flex-wrap">
                            <span className={cn(product.stock <= 5 ? 'text-red-600 font-bold' : 'font-medium', 'text-base', 'flex items-center gap-1')}>
                              <Package className="h-3.5 w-3.5" /> 實 {product.stock}
                            </span>
                            {product.stock === 0 ? (
                              <Badge variant="outline" className="border-red-600 text-red-600 px-1 py-0 h-4 text-[10px]">缺貨</Badge>
                            ) : null}
                          </span>
                          {(product.available_stock !== undefined) && (
                            <div className="text-[11px] text-muted-foreground grid grid-cols-3 gap-1 min-w-[110px]">
                              <span title="可用庫存">可: <span className="text-green-600 font-medium">{product.available_stock}</span></span>
                              <span title="保留庫存">留: <span className="text-orange-500 font-medium">{product.reserved_stock}</span></span>
                              <span title="通路庫存">通: <span className="text-blue-600 font-medium">{product.channel_stock_easystore}</span></span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm">{product.categories?.name || '-'}</td>
                      <td className="p-4 text-sm align-top">
                        {product.tagChips && product.tagChips.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {product.tagChips.map((t) => (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs bg-background"
                                style={{ borderColor: t.color }}
                              >
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full border border-black/10"
                                  style={{ backgroundColor: t.color }}
                                  aria-hidden
                                />
                                {t.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(product.is_active, product.stock, product.low_stock_threshold)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(product.created_at)}
                      </td>
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
                productStatus: productStatusFilter ?? null,
                tags: tagsForHref,
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
                productStatus: productStatusFilter ?? null,
                tags: tagsForHref,
              })}
            >
              <Button variant={page === currentPage ? 'default' : 'outline'} size="sm">
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
                productStatus: productStatusFilter ?? null,
                tags: tagsForHref,
              })}
            >
              <Button variant="outline">下一頁</Button>
            </Link>
          )}
        </div>
      )}
    </>
  );
}
