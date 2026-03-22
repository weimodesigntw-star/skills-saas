'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type MemberOption = {
  id: string;
  name: string;
  client_code: string | null;
};

interface MemberComboboxProps {
  members: MemberOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  /**
   * 下拉最多顯示幾筆（無搜尋字／有搜尋字皆套用）。
   * 預設 500 與多數頁面 fetchMembers({ pageSize: 500 }) 一致；
   * 沖帳頁需載入更多會員時請加大並搭配較大的 fetchMembers pageSize。
   */
  maxVisibleOptions?: number;
}

const DEFAULT_MAX_VISIBLE = 500;

export function MemberCombobox({
  members,
  value,
  onChange,
  placeholder = '搜尋客戶...',
  allLabel = '全部',
  maxVisibleOptions = DEFAULT_MAX_VISIBLE,
}: MemberComboboxProps) {
  const [q, setQ] = useState('');
  const selected = members.find((m) => m.id === value) ?? null;
  const cap = Math.max(1, maxVisibleOptions);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return members.slice(0, cap);
    return members
      .filter((m) => {
        const label = m.client_code ? `${m.name} ${m.client_code}` : m.name;
        return label.toLowerCase().includes(keyword);
      })
      .slice(0, cap);
  }, [members, q, cap]);

  return (
    <div className="flex items-center gap-2">
      <Input
        className="w-44"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[220px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{allLabel}</option>
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>
            {m.client_code ? `${m.name}（${m.client_code}）` : m.name}
          </option>
        ))}
      </select>
      {value && (
        <Button variant="ghost" size="sm" onClick={() => onChange('')}>
          清除
        </Button>
      )}
      {selected && (
        <span className="text-xs text-muted-foreground truncate max-w-[180px]">
          已選：{selected.client_code ? `${selected.name}（${selected.client_code}）` : selected.name}
        </span>
      )}
    </div>
  );
}
