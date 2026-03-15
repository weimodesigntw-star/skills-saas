/**
 * 發票管理頁 P0-3
 * 列表（篩選：狀態、日期）、作廢、重印
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { formatNTD } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  fetchInvoices,
  voidInvoice,
  getInvoiceDetail,
  type InvoiceWithOrderNumber,
} from '@/app/actions/invoices';
import type { OrderItem } from '@/lib/types/pos';
import { Trash2, Printer, ChevronLeft, ChevronRight, Receipt, Search } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'issued', label: '有效' },
  { value: 'voided', label: '已作廢' },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithOrderNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const pageSize = 20;

  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  const [reprintDialogOpen, setReprintDialogOpen] = useState(false);
  const [reprintData, setReprintData] = useState<{
    invoice_number: string;
    created_at: string;
    buyer_name: string | null;
    buyer_identifier: string;
    items: OrderItem[];
    subtotal: number;
    tax_amount: number;
    total_amount: number;
  } | null>(null);
  const [reprintLoading, setReprintLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchInvoices({
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page,
      pageSize,
    });
    if (res.error) toast.error(res.error);
    else {
      setInvoices(res.invoices);
      setTotal(res.total);
    }
    setLoading(false);
  }, [page, statusFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

  const handleVoid = async () => {
    if (!selectedInvoiceId || !voidReason.trim()) {
      toast.error('請填寫作廢原因');
      return;
    }
    setVoidLoading(true);
    const result = await voidInvoice(selectedInvoiceId, voidReason);
    setVoidLoading(false);
    if (result.success) {
      toast.success('發票已作廢');
      setVoidDialogOpen(false);
      setSelectedInvoiceId(null);
      setVoidReason('');
      load();
    } else {
      toast.error(result.error || '作廢失敗');
    }
  };

  const openReprint = async (invoiceId: string) => {
    setReprintDialogOpen(true);
    setReprintLoading(true);
    setReprintData(null);
    const detail = await getInvoiceDetail(invoiceId);
    setReprintLoading(false);
    if (detail.error || !detail.invoice || !detail.order) {
      toast.error(detail.error || '無法載入發票');
      return;
    }
    const o = detail.order!;
    setReprintData({
      invoice_number: detail.invoice.invoice_number,
      created_at: detail.invoice.created_at ?? '',
      buyer_name: detail.invoice.buyer_name ?? null,
      buyer_identifier: detail.invoice.buyer_identifier ?? '0000000000',
      items: detail.items ?? [],
      subtotal: Number(o.subtotal ?? detail.invoice.sales_amount),
      tax_amount: Number(o.tax_amount ?? detail.invoice.tax_amount),
      total_amount: Number(o.total_amount ?? detail.invoice.total_amount),
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">發票管理</h1>
        <p className="text-muted-foreground text-sm">對已成立的訂單開立、查詢、作廢與重印發票</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">狀態</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">日期起</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">日期訖</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
            </div>
            <Button variant="secondary" size="sm" onClick={() => load()}>
              <Search className="h-4 w-4 mr-2" />
              查詢
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="尚無發票"
              description="請在訂單詳情頁對訂單開立發票"
            />
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">發票號碼</th>
                      <th className="text-left p-3 font-medium">訂單編號</th>
                      <th className="text-left p-3 font-medium">開立時間</th>
                      <th className="text-right p-3 font-medium">金額</th>
                      <th className="text-left p-3 font-medium">狀態</th>
                      <th className="p-3 text-right w-32">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-t hover:bg-muted/30">
                        <td className="p-3 font-mono">{inv.invoice_number}</td>
                        <td className="p-3 text-muted-foreground">{inv.order_number ?? '-'}</td>
                        <td className="p-3">
                          {inv.created_at
                            ? new Date(inv.created_at).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
                            : inv.invoice_date}
                        </td>
                        <td className="p-3 text-right font-medium">{formatNTD(Number(inv.total_amount))}</td>
                        <td className="p-3">
                          <Badge variant={inv.status === 'issued' ? 'success' : 'destructive'}>
                            {inv.status === 'issued' ? '有效' : '已作廢'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openReprint(inv.id)} title="重印">
                              <Printer className="h-4 w-4" />
                            </Button>
                            {inv.status === 'issued' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedInvoiceId(inv.id);
                                  setVoidReason('');
                                  setVoidDialogOpen(true);
                                }}
                                title="作廢"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    共 {total} 筆，第 {page} / {totalPages} 頁
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" /> 上一頁
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                      下一頁 <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 作廢 Dialog（需填原因） */}
      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作廢發票</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">請填寫作廢原因，此操作無法復原。</p>
          <Input
            placeholder="例：開立錯誤、重複開立"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={voidLoading}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={voidLoading || !voidReason.trim()}>
              {voidLoading ? '處理中…' : '確定作廢'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 重印 Dialog */}
      <Dialog open={reprintDialogOpen} onOpenChange={setReprintDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>發票重印</DialogTitle>
          </DialogHeader>
          {reprintLoading ? (
            <div className="py-8 text-center text-muted-foreground">載入中…</div>
          ) : reprintData ? (
            <div className="space-y-4 font-sans" id="reprint-content">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">發票號碼</span>
                <span className="font-mono">{reprintData.invoice_number}</span>
                <span className="text-muted-foreground">開立時間</span>
                <span>{new Date(reprintData.created_at).toLocaleString('zh-TW')}</span>
                <span className="text-muted-foreground">買受人</span>
                <span>{reprintData.buyer_name || '—'}</span>
                <span className="text-muted-foreground">統一編號</span>
                <span>{reprintData.buyer_identifier === '0000000000' ? '—' : reprintData.buyer_identifier}</span>
              </div>
              <div className="border-t pt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">品項</th>
                      <th className="text-right py-2">單價</th>
                      <th className="text-right py-2">數量</th>
                      <th className="text-right py-2">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reprintData.items.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="py-2">{item.product_name}</td>
                        <td className="text-right">{formatNTD(item.unit_price)}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">{formatNTD(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end">
                <dl className="w-56 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">小計</dt>
                    <dd>{formatNTD(reprintData.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">稅額（5%）</dt>
                    <dd>{formatNTD(reprintData.tax_amount)}</dd>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-medium">
                    <dt>總計</dt>
                    <dd>{formatNTD(reprintData.total_amount)}</dd>
                  </div>
                </dl>
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  列印
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}