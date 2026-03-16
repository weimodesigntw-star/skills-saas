'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchShipmentById } from '@/app/actions/shipments';
import { receivePayment } from '@/app/actions/shipments';
import { formatNTD } from '@/lib/constants';
import { toast } from '@/components/ui/toast';

interface ReceivePaymentDialogProps {
  shipmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ReceivePaymentDialog({
  shipmentId,
  open,
  onOpenChange,
  onSuccess,
}: ReceivePaymentDialogProps) {
  const [shipment, setShipment] = useState<{
    ship_code: string;
    total: number;
    amt_recd: number;
    amt_outstanding: number;
  } | null>(null);
  const [amt, setAmt] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !shipmentId) return;
    setLoading(true);
    setAmt('');
    setNote('');
    fetchShipmentById(shipmentId).then((data) => {
      setShipment(data ? { ship_code: data.ship_code, total: Number(data.total), amt_recd: Number(data.amt_recd), amt_outstanding: Number(data.amt_outstanding) } : null);
      setLoading(false);
    });
  }, [open, shipmentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amt);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('請輸入有效收款金額');
      return;
    }
    setSubmitting(true);
    const result = await receivePayment(shipmentId, value, note.trim() || undefined);
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('收款已記錄');
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>收款</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">載入中...</p>
        ) : shipment ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm space-y-1">
              <p>出貨單：{shipment.ship_code}</p>
              <p>合計：{formatNTD(shipment.total)}</p>
              <p>已收：{formatNTD(shipment.amt_recd)}</p>
              <p>未收：{formatNTD(shipment.amt_outstanding)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receive-amt">收款金額</Label>
              <Input
                id="receive-amt"
                type="number"
                step="0.01"
                min="0.01"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receive-note">備註（選填）</Label>
              <Input
                id="receive-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="選填"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '處理中...' : '確認收款'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground py-4">找不到出貨單</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
