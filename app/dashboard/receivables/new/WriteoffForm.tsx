'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { fetchMembers } from '@/app/actions/customer-members';
import { fetchMemberById } from '@/app/actions/customer-members';
import { fetchPendingShipmentsByMember } from '@/app/actions/receivable-writeoffs';
import { createWriteoff } from '@/app/actions/receivable-writeoffs';
import { toast } from '@/components/ui/toast';
import { formatNTD } from '@/lib/constants';

type PendingShipment = {
  id: string;
  ship_code: string;
  ship_date: string | null;
  total: number;
  amt_recd: number;
  amt_outstanding: number;
};

export function WriteoffForm() {
  const router = useRouter();
  const [members, setMembers] = useState<{ id: string; name: string; client_code: string | null }[]>([]);
  const [memberId, setMemberId] = useState('');
  const [pendingShipments, setPendingShipments] = useState<PendingShipment[]>([]);
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
    fetchMembers({ pageSize: 500 }).then((r) =>
      setMembers((r.members as { id: string; name: string; client_code: string | null }[]) ?? [])
    );
  }, []);

  useEffect(() => {
    if (!memberId) {
      setMemberPrepaid(0);
      return;
    }
    fetchMemberById(memberId).then((m) => {
      setMemberPrepaid(Number((m as any)?.prepaid) ?? 0);
    });
  }, [memberId]);

  const loadPending = () => {
    if (!memberId) {
      toast.error('請先選擇客戶');
      return;
    }
    setLoadingPending(true);
    fetchPendingShipmentsByMember(memberId).then((list) => {
      setPendingShipments(list);
      const amounts: Record<string, number> = {};
      const ids = new Set<string>();
      list.forEach((s) => {
        amounts[s.id] = s.amt_outstanding;
        ids.add(s.id);
      });
      setWriteoffAmounts(amounts);
      setSelectedIds(ids);
      setLoadingPending(false);
    });
  };

  const setAmount = (shipmentId: string, value: number) => {
    const ship = pendingShipments.find((s) => s.id === shipmentId);
    const max = ship ? ship.amt_outstanding : 0;
    const clamped = Math.min(Math.max(0, value), max);
    setWriteoffAmounts((prev) => ({ ...prev, [shipmentId]: clamped }));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalCharge = pendingShipments
    .filter((s) => selectedIds.has(s.id))
    .reduce((sum, s) => sum + (writeoffAmounts[s.id] ?? 0), 0);
  const actualRecd = totalCharge - discount - prepaidUsed;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      toast.error('請選擇客戶');
      return;
    }
    const items = pendingShipments
      .filter((s) => selectedIds.has(s.id) && (writeoffAmounts[s.id] ?? 0) > 0)
      .map((s) => ({
        shipment_id: s.id,
        ship_code: s.ship_code,
        charge_amount: s.amt_outstanding,
        writeoff_amount: writeoffAmounts[s.id] ?? 0,
      }));
    if (items.length === 0) {
      toast.error('請至少勾選一張出貨單並填寫本次沖帳金額');
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
        <div className="space-y-2">
          <Label>選擇客戶</Label>
          <div className="flex gap-2">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[200px]"
              value={memberId}
              onChange={(e) => {
                setMemberId(e.target.value);
                setPendingShipments([]);
                setSelectedIds(new Set());
                setWriteoffAmounts({});
              }}
            >
              <option value="">請選擇客戶</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.client_code ? `${m.name}（${m.client_code}）` : m.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={loadPending} disabled={loadingPending || !memberId}>
              {loadingPending ? '載入中...' : '查詢待收'}
            </Button>
          </div>
        </div>
      </div>

      {pendingShipments.length > 0 && (
        <>
          <div className="space-y-2">
            <Label>勾選出貨單並填寫本次沖帳金額</Label>
            <div className="rounded border overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-10 text-left py-2 px-3">勾選</th>
                    <th className="text-left py-2 px-3 font-semibold">出貨單號</th>
                    <th className="text-left py-2 px-3 font-semibold">出貨日期</th>
                    <th className="text-right py-2 px-3 font-semibold">合計</th>
                    <th className="text-right py-2 px-3 font-semibold">未收金額</th>
                    <th className="text-right py-2 px-3 font-semibold">本次沖帳金額</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingShipments.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelected(s.id)}
                          className="h-4 w-4"
                        />
                      </td>
                      <td className="py-2 px-3 font-mono">{s.ship_code}</td>
                      <td className="py-2 px-3">{s.ship_date ?? '—'}</td>
                      <td className="py-2 px-3 text-right">{formatNTD(s.total)}</td>
                      <td className="py-2 px-3 text-right">{formatNTD(s.amt_outstanding)}</td>
                      <td className="py-2 px-3">
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={s.amt_outstanding}
                          className="h-8 w-28 text-right"
                          value={selectedIds.has(s.id) ? (writeoffAmounts[s.id] ?? s.amt_outstanding) : 0}
                          onChange={(e) => setAmount(s.id, parseFloat(e.target.value) || 0)}
                          disabled={!selectedIds.has(s.id)}
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
