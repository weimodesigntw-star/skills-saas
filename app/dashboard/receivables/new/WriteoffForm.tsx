'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchMembers } from '@/app/actions/customer-members';
import { fetchMemberById } from '@/app/actions/customer-members';
import {
  fetchPendingShipmentsByMember,
  fetchPendingCustomerOrdersByMember,
  createWriteoff,
} from '@/app/actions/receivable-writeoffs';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';
import { MemberCombobox } from '@/components/ui/member-combobox';

type PendingShipment = {
  id: string;
  ship_code: string;
  ship_date: string | null;
  total: number;
  amt_recd: number;
  amt_outstanding: number;
};

type PendingCustomerOrder = {
  id: string;
  order_code: string;
  ship_date: string | null;
  total: number;
  amt_recd: number;
  amt_outstanding: number;
};

export function WriteoffForm() {
  const router = useRouter();
  const [members, setMembers] = useState<{ id: string; name: string; client_code: string | null }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [writeoffSource, setWriteoffSource] = useState<'shipment' | 'customer_order'>('shipment');
  const [pendingShipments, setPendingShipments] = useState<PendingShipment[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingCustomerOrder[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [writeoffDate, setWriteoffDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [prepaidUsed, setPrepaidUsed] = useState(0);
  const [memberPrepaid, setMemberPrepaid] = useState<number>(0);
  const [note, setNote] = useState('');
  const [writeoffAmounts, setWriteoffAmounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // 依 total_spent 排序時，低消費客戶可能落在 500 名外；沖帳須能選到所有會員
    fetchMembers({ pageSize: 10000 }).then((r) =>
      setMembers((r.members as { id: string; name: string; client_code: string | null }[]) ?? [])
    );
  }, []);

  useEffect(() => {
    if (!memberId) {
      setMemberPrepaid(0);
      return;
    }
    fetchMemberById(memberId).then((m) => {
      setMemberPrepaid(Number((m as { prepaid?: number })?.prepaid) ?? 0);
    });
  }, [memberId]);

  const currentPending =
    writeoffSource === 'shipment'
      ? pendingShipments.map((s) => ({
          id: s.id,
          code: s.ship_code,
          date: s.ship_date,
          total: s.total,
          outstanding: s.amt_outstanding,
        }))
      : pendingOrders.map((o) => ({
          id: o.id,
          code: o.order_code,
          date: o.ship_date,
          total: o.total,
          outstanding: o.amt_outstanding,
        }));

  const loadPending = async () => {
    if (!memberId) {
      toast.error('請先選擇客戶');
      return;
    }
    setLoadingPending(true);
    try {
      const maxAttempts = 3;
      let attempt = 0;
      let done = false;
      while (attempt < maxAttempts && !done) {
        attempt += 1;
        try {
          if (writeoffSource === 'shipment') {
            const list = await fetchPendingShipmentsByMember(memberId);
            setPendingShipments(list);
            setPendingOrders([]);
            const amounts: Record<string, number> = {};
            const ids = new Set<string>();
            list.forEach((s) => {
              amounts[s.id] = s.amt_outstanding;
              ids.add(s.id);
            });
            setWriteoffAmounts(amounts);
            setSelectedIds(ids);
          } else {
            const list = await fetchPendingCustomerOrdersByMember(memberId);
            setPendingOrders(list);
            setPendingShipments([]);
            const amounts: Record<string, number> = {};
            const ids = new Set<string>();
            list.forEach((o) => {
              amounts[o.id] = o.amt_outstanding;
              ids.add(o.id);
            });
            setWriteoffAmounts(amounts);
            setSelectedIds(ids);
          }
          done = true;
        } catch {
          if (attempt >= maxAttempts) throw new Error('FETCH_PENDING_FAILED');
          // 新部署 cold start 常見短暫 503，等一下再重試
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        }
      }
    } catch {
      toast.error('查詢待收失敗，請稍後再試');
    } finally {
      setLoadingPending(false);
    }
  };

  const setAmount = (docId: string, value: number) => {
    const row = currentPending.find((r) => r.id === docId);
    const max = row ? row.outstanding : 0;
    const clamped = Math.min(Math.max(0, value), max);
    setWriteoffAmounts((prev) => ({ ...prev, [docId]: clamped }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCharge = currentPending
    .filter((r) => selectedIds.has(r.id))
    .reduce((sum, r) => sum + (writeoffAmounts[r.id] ?? 0), 0);
  const actualRecd = totalCharge - discount - prepaidUsed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      toast.error('請選擇客戶');
      return;
    }
    const items =
      writeoffSource === 'shipment'
        ? pendingShipments
            .filter((s) => selectedIds.has(s.id) && (writeoffAmounts[s.id] ?? 0) > 0)
            .map((s) => ({
              shipment_id: s.id,
              ship_code: s.ship_code,
              charge_amount: s.amt_outstanding,
              writeoff_amount: writeoffAmounts[s.id] ?? 0,
            }))
        : pendingOrders
            .filter((o) => selectedIds.has(o.id) && (writeoffAmounts[o.id] ?? 0) > 0)
            .map((o) => ({
              customer_order_id: o.id,
              order_code: o.order_code,
              charge_amount: o.amt_outstanding,
              writeoff_amount: writeoffAmounts[o.id] ?? 0,
            }));
    if (items.length === 0) {
      toast.error('請至少勾選一筆並填寫本次沖帳金額');
      return;
    }
    if (prepaidUsed > memberPrepaid) {
      toast.error('動用預收不可超過客戶餘額');
      return;
    }
    setSubmitting(true);
    const result = await createWriteoff({
      writeoff_date: writeoffDate,
      member_id: memberId,
      discount,
      prepaid_used: prepaidUsed,
      note: note.trim() || undefined,
      items,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('沖帳完成');
    router.push(`/dashboard/receivables/${result.writeoffId}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label>選擇客戶</Label>
          <div className="flex flex-wrap gap-2 items-center">
            <MemberCombobox
              members={members}
              value={memberId}
              onChange={(v) => {
                setMemberId(v);
                setPendingShipments([]);
                setPendingOrders([]);
                setSelectedIds(new Set());
                setWriteoffAmounts({});
              }}
              placeholder="搜尋客戶"
              allLabel="請選擇客戶"
              maxVisibleOptions={10000}
            />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>沖帳來源</Label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="src"
                checked={writeoffSource === 'shipment'}
                onChange={() => {
                  setWriteoffSource('shipment');
                  setPendingShipments([]);
                  setPendingOrders([]);
                  setSelectedIds(new Set());
                  setWriteoffAmounts({});
                }}
              />
              POS 出貨單
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="src"
                checked={writeoffSource === 'customer_order'}
                onChange={() => {
                  setWriteoffSource('customer_order');
                  setPendingShipments([]);
                  setPendingOrders([]);
                  setSelectedIds(new Set());
                  setWriteoffAmounts({});
                }}
              />
              客戶訂單（EasyStore / 手開）
            </label>
            <Button type="button" variant="outline" onClick={loadPending} disabled={loadingPending || !memberId}>
              {loadingPending ? '載入中...' : '查詢待收'}
            </Button>
          </div>
        </div>
      </div>

      {currentPending.length > 0 && (
        <>
          <div className="space-y-2">
            <Label>勾選單據並填寫本次沖帳金額</Label>
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-10 text-left py-2 px-3">勾選</th>
                    <th className="text-left py-2 px-3 font-semibold">單號</th>
                    <th className="text-left py-2 px-3 font-semibold">日期</th>
                    <th className="text-right py-2 px-3 font-semibold">合計</th>
                    <th className="text-right py-2 px-3 font-semibold">未收金額</th>
                    <th className="text-right py-2 px-3 font-semibold">本次沖帳金額</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPending.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelected(r.id)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">{r.code}</td>
                      <td className="py-2 px-3">{r.date ?? '—'}</td>
                      <td className="py-2 px-3 text-right">{formatNTD(r.total)}</td>
                      <td className="py-2 px-3 text-right">{formatNTD(r.outstanding)}</td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={r.outstanding}
                          className="h-8 w-28 text-right"
                          value={selectedIds.has(r.id) ? (writeoffAmounts[r.id] ?? r.outstanding) : 0}
                          onChange={(e) => setAmount(r.id, parseFloat(e.target.value) || 0)}
                          disabled={!selectedIds.has(r.id)}
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
              <Label htmlFor="writeoff_date">沖帳日期</Label>
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
            <div className="space-y-2">
              <Label>預收款（客戶餘額）</Label>
              <p className="text-sm py-1">{formatNTD(memberPrepaid)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prepaid_used">動用預收</Label>
              <Input
                id="prepaid_used"
                type="number"
                step="0.01"
                min={0}
                max={memberPrepaid}
                value={prepaidUsed}
                onChange={(e) => setPrepaidUsed(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">備註</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="選填" />
          </div>

          <div className="border-t pt-4 space-y-1 text-sm text-right">
            <p>應收合計：{formatNTD(totalCharge)}</p>
            <p>折讓：{formatNTD(discount)}</p>
            <p>動用預收：{formatNTD(prepaidUsed)}</p>
            <p className="font-bold">實收金額：{formatNTD(actualRecd)}</p>
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
