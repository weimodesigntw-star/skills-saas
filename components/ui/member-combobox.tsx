'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type MemberOption = {
  id: string;
  name: string;
  client_code: string | null;
  phone?: string | null;
};

interface MemberComboboxProps {
  members: MemberOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allLabel?: string;
  onSearchChange?: (query: string) => void;
  maxVisibleOptions?: number;
}

const DEFAULT_MAX_VISIBLE = 500;

function phonePrefixes(query: string) {
  const digits = query.replace(/\D/g, '');
  if (!digits) return [];

  const prefixes = new Set([digits]);
  if (digits.startsWith('0')) prefixes.add(`886${digits.slice(1)}`);
  if (digits.startsWith('886')) prefixes.add(`0${digits.slice(3)}`);
  return [...prefixes];
}

export function MemberCombobox({
  members,
  value,
  onChange,
  placeholder = '輸入電話搜尋客戶',
  allLabel = '無會員',
  onSearchChange,
  maxVisibleOptions = DEFAULT_MAX_VISIBLE,
}: MemberComboboxProps) {
  const [q, setQ] = useState('');
  const selected = members.find((m) => m.id === value) ?? null;
  const cap = Math.max(1, maxVisibleOptions);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return members.slice(0, cap);

    const prefixes = phonePrefixes(keyword);
    return members
      .filter((m) => {
        const phone = (m.phone ?? '').replace(/\D/g, '');
        if (prefixes.length > 0) return prefixes.some((prefix) => phone.startsWith(prefix));

        const nameCode = m.client_code ? `${m.name} ${m.client_code}` : m.name;
        return nameCode.toLowerCase().includes(keyword);
      })
      .slice(0, cap);
  }, [members, q, cap]);

  const memberLabel = (m: MemberOption) => {
    const name = m.client_code ? `${m.name}（${m.client_code}）` : m.name;
    return m.phone ? `${name} - ${m.phone}` : name;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="w-48"
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          onSearchChange?.(e.target.value);
        }}
      />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[240px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{allLabel}</option>
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>
            {memberLabel(m)}
          </option>
        ))}
      </select>
      {value && (
        <Button variant="ghost" size="sm" onClick={() => onChange('')}>
          清除
        </Button>
      )}
      <span className="text-sm font-medium text-foreground min-w-[160px]">
        {selected ? selected.name : q.trim() ? '查無唯一客戶' : '輸入電話後顯示客戶名稱'}
      </span>
    </div>
  );
}
