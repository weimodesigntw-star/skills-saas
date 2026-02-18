/**
 * Invoice Management Page
 *
 * 電子發票管理頁面：
 * - 發票列表（表格格式）
 * - 篩選：狀態、日期範圍
 * - 操作：檢視、作廢
 * - 分頁
 */

'use client';

import { useState, useEffect } from 'react';
import { formatNTD } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import { getInvoices, voidInvoice } from '@/app/actions/invoices';
import { Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  buyer_identifier: string;
  buyer_name: string | null;
  total_amount: number;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  issued: '已開立',
  voided: '已作廢',
  allowanced: '已折讓',
};

const STATUS_COLORS: Record<string, 'success' | 'destructive' | 'warning'> = {
  issued: 'success',
  voided: 'destructive',
  allowanced: 'warning',
};

const TYPE_LABELS: Record<string, string> = {
  B2C: '二聯式',
  B2B: '三聯式',
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Void Dialog
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);

  const pageSize = 20;

  // Load invoices
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const result = await getInvoices(page, pageSize, statusFilter || undefined, dateFrom || undefined, dateTo || undefined);

      if (result.error) {
        toast.error(result.error);
      } else {
        setInvoices(result.invoices);
        setTotal(result.total);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '載入失敗';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadInvoices();
  }, [page, statusFilter, dateFrom, dateTo]);

  const handleVoid = async () => {
    if (!selectedInvoiceId || !voidReason.trim()) {
      toast.error('請填寫作廢原因');
      return;
    }

    try {
      setVoidLoading(true);
      const result = await voidInvoice(selectedInvoiceId, voidReason);

      if (result.success) {
        toast.success('發票已作廢');
        setVoidDialogOpen(false);
        setSelectedInvoiceId(null);
        setVoidReason('');
        loadInvoices();
      } else {
        toast.error(result.error || '作廢失敗');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '作廢失敗';
      toast.error(msg);
    } finally {
      setVoidLoading(false);
    }
  };

  const handleOpenVoidDialog = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setVoidReason('');
    setVoidDialogOpen(true);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">發票管理</h1>
        <p className="text-muted-foreground mt-2">查看和管理所有電子發票</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">篩選</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status">狀態</Label>
              <select
                id="status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              >
                <option value="">全部</option>
                <option value="issued">已開立</option>
                <option value="voided">已作廢</option>
                <option value="allowanced">已折讓</option>
              </select>
            </div>

            {/* Date From */}
            <div className="space-y-2">
              <Label htmlFor="date-from">開始日期</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-2">
              <Label htmlFor="date-to">結束日期</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('');
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                重設篩選
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              載入中...
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              尚無發票紀錄
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-6 py-3 text-left text-sm font-medium">發票號碼</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">開立日期</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">類型</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">買方</th>
                    <th className="px-6 py-3 text-right text-sm font-medium">金額</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">狀態</th>
                    <th className="px-6 py-3 text-center text-sm font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-3 text-sm font-mono">{invoice.invoice_number}</td>
                      <td className="px-6 py-3 text-sm">{invoice.invoice_date}</td>
                      <td className="px-6 py-3 text-sm">
                        <Badge variant="outline">
                          {TYPE_LABELS[invoice.invoice_type] || invoice.invoice_type}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-sm">
                        {invoice.buyer_name || invoice.buyer_identifier || '個人'}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-medium">
                        {formatNTD(invoice.total_amount)}
                      </td>
                      <td className="px-6 py-3 text-sm text-center">
                        <Badge
                          variant={
                            STATUS_COLORS[invoice.status] || 'default'
                          }
                        >
                          {STATUS_LABELS[invoice.status] || invoice.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-sm text-center">
                        <div className="flex justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="檢視"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          {invoice.status === 'issued' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="作廢"
                              onClick={() => handleOpenVoidDialog(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            第 {page + 1} 頁，共 {totalPages} 頁 ({total} 筆)
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Void Dialog */}
      {voidDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>作廢發票</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                確定要作廢此發票嗎？此操作無法復原。
              </p>
              <div className="space-y-2">
                <Label htmlFor="void-reason">作廢原因 *</Label>
                <Input
                  id="void-reason"
                  type="text"
                  placeholder="e.g. 開立錯誤、重複開立"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setVoidDialogOpen(false)}
                  disabled={voidLoading}
                >
                  取消
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleVoid}
                  disabled={voidLoading || !voidReason.trim()}
                >
                  {voidLoading ? '處理中...' : '確定作廢'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
