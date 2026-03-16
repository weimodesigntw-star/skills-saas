'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getVendors } from '@/app/actions/vendors';
import { fetchPendingPurchasesByVendor } from '@/app/actions/payable-writeoffs';
import { createPayableWriteoff } from '@/app/actions/payable-writeoffs';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';

type PendingPurchase = {
  id: string;
  receive_code: string;
  receive_day: string | null;
  total: number;
  amt_paid: number;
  amt_unpaid: number;
};

export function PayableWriteoffForm() {
  const router = useRouter();
  const [vendors, setVendors] = useState<{ id: string; vendor_code: string; vendor_name: string }[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [pendingPurchases, setPendingPurchases] = useState<PendingPurchase[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [writeoffDate, setWriteoffDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [note, setNote] = useState('');
  const [writeoffAmounts, setWriteoffAmounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getVendors().then(setVendors);
  }, []);

  const loadPending = () => {
    if (!vendorId) {
      toast.error('請先選擇廠商');
      return;
    }
    setLoadingPending(true);
    fetchPendingPurchasesByVendor(vendorId).then((list) => {
      setPendingPurchases(list);
      const amounts: Record<string, number> = {};
      const ids = new Set<string>();
      list.forEach((p) => {
        amounts[p.id] = p.amt_unpaid;
        ids.add(p.id);
      });
      setWriteoffAmounts(amounts);
      setSelectedIds(ids);
      setLoadingPending(false);
    });
  };

  const setAmount = (purchaseId: string, value: number) => {
    const po = pendingPurchases.find((p) => p.id === purchaseId);
    const max = po ? po.amt_unpaid : 0;
    const clamped = Math.min(Math.max(0, value), max);
    setWriteoffAmounts((prev) => ({ ...prev, [purchaseId]: clamped }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCharge = pendingPurchases
    .filter((p) => selectedIds.has(p.id))
    .reduce((sum, p) => sum + (writeoffAmounts[p.id] ?? 0), 0);
  const actualPaid = totalCharge - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorId) {
      toast.error('請選擇廠商');
      return;
    }
    const items = pendingPurchases
      .filter((p) => selectedIds.has(p.id) && (writeoffAmounts[p.id] ?? 0) > 0)
      .map((p) => ({
        purchase_id: p.id,
        receive_code: p.receive_code,
        charge_amount: p.amt_unpaid,
        writeoff_amount: writeoffAmounts[p.id] ?? 0,
      }));
    if (items.length === 0) {
      toast.error('請至少勾選一張採購單並填寫本次付款金額');
      return;
    }
    setSubmitting(true);
    const result = await createPayableWriteoff({
      writeoff_date: writeoffDate,
      vendor_id: vendorId,
      discount,
      note: note.trim() || undefined,
      items,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('沖帳完成');
    router.push(`/dashboard/payables/${result.writeoffId}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>選擇廠商</Label>
          <div className="flex gap-2">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[200px]"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value);
                setPendingPurchases([]);
                setSelectedIds(new Set());
                setWriteoffAmounts({});
              }}
            >
              <option value="">請選擇廠商</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_name}（{v.vendor_code}）
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={loadPending} disabled={loadingPending || !vendorId}>
              {loadingPending ? '載入中...' : '查詢待付'}
            </Button>
          </div>
        </div>
      </div>

      {pendingPurchases.length > 0 && (
        <>
          <div className="space-y-2">
            <Label>勾選採購單並填寫本次付款金額</Label>
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-10 text-left py-2 px-3">勾選</th>
                    <th className="text-left py-2 px-3 font-semibold">採購單號</th>
                    <th className="text-left py-2 px-3 font-semibold">進貨日期</th>
                    <th className="text-right py-2 px-3 font-semibold">合計</th>
                    <th className="text-right py-2 px-3 font-semibold">未付金額</th>
                    <th className="text-right py-2 px-3 font-semibold">本次付款金額</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPurchases.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onChange={() => toggleSelected(p.id)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">{p.receive_code}</td>
                      <td className="py-2 px-3">{p.receive_day ?? '—'}</td>
                      <td className="py-2 px-3 text-right">{formatNTD(p.total)}</td>
                      <td className="py-2 px-3 text-right">{formatNTD(p.amt_unpaid)}</td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={p.amt_unpaid}
                          className="h-8 w-28 text-right"
                          value={selectedIds.has(p.id) ? (writeoffAmounts[p.id] ?? p.amt_unpaid) : 0}
                          onChange={(e) => setAmount(p.id, parseFloat(e.target.value) || 0)}
                          disabled={!selectedIds.has(p.id)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="writeoff_date">付款日期</Label>
              <Input
                id="writeoff_date"
                type="date"
                value={writeoffDate}
                onChange={(e) => setWriteoffDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount">折讓</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">備註</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="選填" />
          </div>

          <div className="border-t pt-4 space-y-1 text-sm text-right">
            <p>應付合計：{formatNTD(totalCharge)}</p>
            <p>折讓：{formatNTD(discount)}</p>
            <p className="font-bold">實付金額：{formatNTD(actualPaid)}</p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '處理中...' : '確認沖帳'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
