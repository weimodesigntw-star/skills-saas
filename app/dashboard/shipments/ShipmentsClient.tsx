'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Eye, DollarSign, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  fetchShipments,
  voidShipment,
} from '@/app/actions/shipments';
import { toast } from '@/components/ui/toast';
import { Truck } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { ReceivePaymentDialog } from '@/components/shipments/ReceivePaymentDialog';

type ShipmentRow = {
  id: string;
  ship_code: string;
  ship_date: string | null;
  member_id: string | null;
  source_order_code: string | null;
  total: number;
  amt_recd: number;
  amt_outstanding: number;
  status: string;
  members: { id: string; name: string; client_code: string | null } | null;
};

interface ShipmentsClientProps {
  initialShipments: ShipmentRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function ShipmentsClient({
  initialShipments,
  total,
  page,
  pageSize,
}: ShipmentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shipments, setShipments] = useState<ShipmentRow[]>(initialShipments);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');
  const [voidId, setVoidId] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);
  const [receiveShipmentId, setReceiveShipmentId] = useState<string | null>(null);

  useEffect(() => {
    setShipments(initialShipments);
  }, [initialShipments]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildParams(overrides?: { page?: number; status?: string; dateFrom?: string; dateTo?: string }) {
    const p = new URLSearchParams();
    const st = overrides?.status ?? statusFilter;
    const df = overrides?.dateFrom ?? dateFrom;
    const dt = overrides?.dateTo ?? dateTo;
    if (st) p.set('status', st);
    if (df) p.set('dateFrom', df);
    if (dt) p.set('dateTo', dt);
    const pg = overrides?.page ?? page;
    if (pg > 1) p.set('page', String(pg));
    return p.toString();
  }

  function handleSearch() {
    router.push(`/dashboard/shipments?${buildParams({ page: 1 })}`);
  }

  function handlePageChange(newPage: number) {
    router.push(`/dashboard/shipments?${buildParams({ page: newPage })}`);
  }

  async function handleVoid() {
    if (!voidId) return;
    setIsVoiding(true);
    const result = await voidShipment(voidId);
    setIsVoiding(false);
    setVoidId(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('出貨單已作廢');
    router.refresh();
  }

  const customerName = (row: ShipmentRow) => {
    const m = row.members;
    return m ? (m.client_code ? `${m.name}（${m.client_code}）` : m.name) : '—';
  };
  const sourceOrder = (row: ShipmentRow) => row.source_order_code ?? '—';

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">出貨管理</h1>
        <Button asChild>
          <Link href="/dashboard/shipments/new">
            <Plus className="mr-1 h-4 w-4" />
            新增出貨單
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">全部狀態</option>
          <option value="valid">有效</option>
          <option value="void">已作廢</option>
        </select>
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Button variant="outline" onClick={handleSearch}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
      </div>

      {shipments.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="尚無出貨單"
          description="可從訂單「轉出貨單」或手動新增"
          action={
            <Button asChild>
              <Link href="/dashboard/shipments/new">
                <Plus className="mr-1 h-4 w-4" />
                新增出貨單
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left py-3 px-4 font-semibold">出貨單號</th>
                  <th className="text-left py-3 px-4 font-semibold">出貨日期</th>
                  <th className="text-left py-3 px-4 font-semibold">客戶名稱</th>
                  <th className="text-left py-3 px-4 font-semibold">來源訂單</th>
                  <th className="text-right py-3 px-4 font-semibold">合計</th>
                  <th className="text-right py-3 px-4 font-semibold">已收</th>
                  <th className="text-right py-3 px-4 font-semibold">未收</th>
                  <th className="text-left py-3 px-4 font-semibold">狀態</th>
                  <th className="text-left py-3 px-4 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-3 px-4 font-mono">{row.ship_code}</td>
                    <td className="py-3 px-4">{row.ship_date ?? '—'}</td>
                    <td className="py-3 px-4">{customerName(row)}</td>
                    <td className="py-3 px-4">{sourceOrder(row)}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.total))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.amt_recd))}</td>
                    <td className="py-3 px-4 text-right">{formatNTD(Number(row.amt_outstanding))}</td>
                    <td className="py-3 px-4">
                      <span
                        className={
                          row.status === 'valid'
                            ? 'inline-flex items-center rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
                            : 'inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                        }
                      >
                        {row.status === 'valid' ? '有效' : '已作廢'}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center gap-1">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/shipments/${row.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      {row.status === 'valid' && Number(row.amt_outstanding) > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReceiveShipmentId(row.id)}
                          title="收款"
                        >
                          <DollarSign className="h-4 w-4" />
                        </Button>
                      )}
                      {row.status === 'valid' && (
                        <Button variant="ghost" size="sm" onClick={() => setVoidId(row.id)} title="作廢">
                          <Ban className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1}>
                上一頁
              </Button>
              <span className="text-sm">第 {page} / {totalPages} 頁</span>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                下一頁
              </Button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!voidId}
        onOpenChange={(open) => !open && setVoidId(null)}
        title="確認作廢"
        description="確定要作廢此出貨單嗎？將回補庫存並還原訂單狀態。"
        onConfirm={handleVoid}
        loading={isVoiding}
      />

      {receiveShipmentId && (
        <ReceivePaymentDialog
          shipmentId={receiveShipmentId}
          open={!!receiveShipmentId}
          onOpenChange={(open) => !open && setReceiveShipmentId(null)}
          onSuccess={() => {
            setReceiveShipmentId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
