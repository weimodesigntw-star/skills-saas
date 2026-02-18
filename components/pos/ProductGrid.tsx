/**
 * POS 商品網格
 *
 * 響應式的商品網格佈局
 * - 桌面: 4-5 欄
 * - 平板: 3-4 欄
 * - 手機: 2-3 欄
 */

'use client';

import { useEffect, useState } from 'react';
import { usePosStore } from '@/store/usePosStore';
import { fetchPosProducts } from '@/app/actions/pos';
import { Product } from '@/lib/types/pos';
import { ProductCard } from './ProductCard';
import { toast as toastFn } from '@/components/ui/toast';

interface ProductGridProps {
  isLoading?: boolean;
}

export function ProductGrid({ isLoading: externalLoading = false }: ProductGridProps) {
  const { selectedCategory, searchQuery } = usePosStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(externalLoading);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setIsLoading(true);
        const data = await fetchPosProducts(
          selectedCategory === null ? undefined : selectedCategory,
          searchQuery || undefined
        );
        setProducts(data);
      } catch (error) {
        console.error('Failed to load products:', error);
        toastFn.error('無法載入商品清單');
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [selectedCategory, searchQuery]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="h-40 bg-muted rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-dashed bg-muted/50">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {searchQuery ? '查無相符的商品' : '此分類無商品'}
          </p>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-1">
              請嘗試其他搜尋詞
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid auto-fill gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
