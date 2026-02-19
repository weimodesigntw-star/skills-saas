/**
 * POS 搜尋欄
 *
 * 支援即時搜尋商品名稱和條碼
 * 使用 debounce 300ms 避免頻繁搜尋
 */

'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePosStore } from '@/store/usePosStore';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';

export function SearchBar() {
  const { searchQuery, setSearchQuery } = usePosStore();
  const [inputValue, setInputValue] = useState(searchQuery);

  // Debounce search query updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputValue);
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue, setSearchQuery]);

  const handleClear = () => {
    setInputValue('');
  };

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <Search className="h-4 w-4" />
      </div>

      <Input
        type="text"
        placeholder="搜尋商品名稱或掃描條碼..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="pl-10 pr-10 h-10"
      />

      {inputValue && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          title="清除搜尋"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
