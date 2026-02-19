/**
 * POS 分類頁籤
 *
 * 橫向可滾動的分類頁籤選擇器
 * 支援「全部」預設頁籤
 */

'use client';

import { useEffect, useState } from 'react';
import { usePosStore } from '@/store/usePosStore';
import { fetchPosCategories } from '@/app/actions/pos';
import { cn } from '@/lib/utils';
import { toast as toastFn } from '@/components/ui/toast';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
}

export function CategoryTabs() {
  const { selectedCategory, selectCategory } = usePosStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const data = await fetchPosCategories();
        setCategories(data);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toastFn.error('無法載入商品分類');
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  if (isLoading) {
    return (
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-10 w-20 bg-muted rounded-md flex-shrink-0 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 pb-2 overflow-x-auto scrollbar-hide">
      {/* 全部 Tab */}
      <button
        onClick={() => selectCategory(null)}
        className={cn(
          'px-4 py-2 rounded-md whitespace-nowrap flex-shrink-0 font-medium transition-colors',
          selectedCategory === null
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:bg-muted/80'
        )}
      >
        全部
      </button>

      {/* 分類 Tabs */}
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => selectCategory(category.id)}
          className={cn(
            'px-4 py-2 rounded-md whitespace-nowrap flex-shrink-0 font-medium transition-colors',
            selectedCategory === category.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
