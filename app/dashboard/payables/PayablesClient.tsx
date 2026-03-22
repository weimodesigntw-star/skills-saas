'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { fetchPayableWriteoffs } from '@/app/actions/payable-writeoffs';
import { getVendors } from '@/app/actions/vendors';
import { toast } from '@/components/ui/toast';
import { CreditCard } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { VendorCombobox } from '@/components/ui/vendor-combobox';

type WriteoffRow = {
  id: string;
  writeoff_code: string;
  writeoff_date: string;
  vendor_id: string | null;
  total_charge: number;
  discount: number;
  actual_paid: number;
  note: string | null;
  vendors: { id: string; vendor_code: string; vendor_name: string } | null;
};

interface PayablesClientProps {
  initialWriteoffs: WriteoffRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function PayablesClient({
  initialWriteoffs,
  total,
  page,
  pageSize,
}: PayablesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [writeoffs, setWriteoffs] = useState<WriteoffRow[]>(initialWriteoffs);
  const [vendorId, setVendorId] = useState(searchParams.get('vendorId') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');
  const [vendors, setVendors] = useState<{ id: string; vendor_code: string; vendor_name: string }[]>([]);

  useEffect(() => {
    setWriteoffs(initialWriteoffs);
  }, [initialWriteoffs]);
  useEffect(() => {
    getVendors().then(setVendors);
  }, []);

  useEffect(() => {
    setVendorId(searchParams.get('vendorId') ?? '');
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildParams(overrides?: { page?: number }) {
    const p = new URLSearchParams();
    if (vendorId) p.set('vendorId', vendorId);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  const vendorLabel = (row: WriteoffRow) =>
    row.vendors ? `${row.vendors.vendor_name}（${row.vendors.vendor_code}）` : '—';

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">應付沖帳</h1>
        <Button asChild>
          <Link href="/dashboard/payables/new">
            <Plus className="mr-1 h-4 w-4" />
            新增沖帳
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <VendorCombobox
          vendors={vendors}
          value={vendorId}
          onChange={setVendorId}
          placeholder="搜尋廠商"
          allLabel="全部廠商"
        />
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button variant="outline" onClick={() => router.push(`/dashboard/payables?${buildParams({ page: 1 })}`)}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
      </div>

      {writeoffs.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="尚無應付沖帳記錄"
          description="點擊「新增沖帳」開始付款"
          action={
            <Button asChild>
              <Link href="/dashboard/payables/new">
                <Plus className="mr-1 h-4 w-4" />
                新增沖帳
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">沖帳單號</th>
                  <th className="text-left py-3 px-4 font-semibold">日期</th>
                  <th className="text-left py-3 px-4 font-semibold">廠商</th>
                  <th className="text-right py-3 px-4 font-semibold">應付總額</th>
                  <th className="text-right py-3 px-4 font-semibold">折讓</th>
                  <th className="text-right py-3 px-4 font-semibold">實付</th>
                  <th className="text-left py-3 px-4 font-semibold">備註</th>
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {writeoffs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4 font-mono">{row.writeoff_code}</td>
                    <td className="py-3 px-4">{row.writeoff_date}</td>
                    <td className="py-3 px-4">{vendorLabel(row)}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.total_charge))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.discount))}</td>
                    <td className="py-3 px-4 text-right font-medium">{formatNTD(Number(row.actual_paid))}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[120px] truncate">{row.note ?? '—'}</td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/payables/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/payables?${buildParams({ page: page - 1 })}`)} disabled={page <= 1}>上一頁</Button>
              <span className="text-sm">第 {page} / {totalPages} 頁</span>
              <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/payables?${buildParams({ page: page + 1 })}`)} disabled={page >= totalPages}>下一頁</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
