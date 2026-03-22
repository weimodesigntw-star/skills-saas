'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export type VendorOption = {
  id: string;
  vendor_code: string;
  vendor_name: string;
};

interface VendorComboboxProps {
  vendors: VendorOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
}

/** F-004 / F-005：可搜尋廠商（概念同 MemberCombobox） */
export function VendorCombobox({
  vendors,
  value,
  onChange,
  placeholder = '搜尋廠商',
  allLabel = '全部廠商',
}: VendorComboboxProps) {
  const [q, setQ] = useState('');
  const selected = vendors.find((v) => v.id === value) ?? null;

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return vendors.slice(0, 300);
    return vendors
      .filter((v) => {
        const label = `${v.vendor_name} ${v.vendor_code}`;
        return label.toLowerCase().includes(keyword);
      })
      .slice(0, 300);
  }, [vendors, q]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-44 min-w-[140px]"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[200px] max-w-[280px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="選擇廠商"
      >
        <option value="">{allLabel}</option>
        {filtered.map((v) => (
          <option key={v.id} value={v.id}>
            {v.vendor_name}（{v.vendor_code}）
          </option>
        ))}
      </select>
      {value && (
        <Button variant="ghost" size="sm" type="button" onClick={() => onChange('')}>
          清除
        </Button>
      )}
      {selected && (
        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
          已選：{selected.vendor_name}（{selected.vendor_code}）
        </span>
      )}
    </div>
  );
}
