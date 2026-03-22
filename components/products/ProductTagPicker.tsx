'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { ProductTag } from '@/app/actions/product-tags';

const DIMENSION_ORDER = ['品項', '工藝', '染色', '素材', '系列'];

export interface ProductTagPickerProps {
  tags: ProductTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function ProductTagPicker({ tags, selectedIds, onChange, disabled }: ProductTagPickerProps) {
  const [search, setSearch] = useState('');
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q) || t.dimension.includes(q));
  }, [tags, search]);

  const byDimension = useMemo(() => {
    const map = new Map<string, ProductTag[]>();
    for (const d of DIMENSION_ORDER) {
      map.set(d, []);
    }
    for (const t of filtered) {
      const list = map.get(t.dimension) ?? [];
      list.push(t);
      map.set(t.dimension, list);
    }
    return map;
  }, [filtered]);

  function toggle(id: string) {
    if (disabled) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium leading-none">搜尋標籤</label>
        <Input
          className="mt-2"
          placeholder="依名稱或維度篩選…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
        />
      </div>

      {DIMENSION_ORDER.map((dim) => {
        const list = byDimension.get(dim) ?? [];
        if (list.length === 0) return null;

        return (
          <div key={dim}>
            <h4 className="text-sm font-semibold text-muted-foreground mb-2">{dim}</h4>
            <div className="flex flex-wrap gap-2">
              {list.map((tag) => {
                const isOn = selected.has(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(tag.id)}
                    className={`
                      inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors
                      ${isOn ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border bg-background hover:bg-muted/50'}
                      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                      style={{ backgroundColor: tag.color }}
                      aria-hidden
                    />
                    <span>{tag.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
