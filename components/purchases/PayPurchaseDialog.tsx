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
import { fetchPurchaseOrderById } from '@/app/actions/purchase-orders';
import { payPurchaseOrder } from '@/app/actions/purchase-orders';
import { formatNTD } from '@/lib/constants';
import { toast } from '@/components/ui/toast';

interface PayPurchaseDialogProps {
  purchaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PayPurchaseDialog({
  purchaseId,
  open,
  onOpenChange,
  onSuccess,
}: PayPurchaseDialogProps) {
  const [purchase, setPurchase] = useState<{
    receive_code: string;
    total: number;
    amt_paid: number;
    amt_unpaid: number;
  } | null>(null);
  const [amt, setAmt] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !purchaseId) return;
    setLoading(true);
    setAmt('');
    fetchPurchaseOrderById(purchaseId).then((data) => {
      setPurchase(
        data
          ? {
              receive_code: data.receive_code,
              total: Number(data.total),
              amt_paid: Number(data.amt_paid),
              amt_unpaid: Number(data.amt_unpaid),
            }
          : null
      );
      setLoading(false);
    });
  }, [open, purchaseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amt);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('請輸入有效付款金額');
      return;
    }
    setSubmitting(true);
    const result = await payPurchaseOrder(purchaseId, value);
    setSubmitting(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('付款已記錄');
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>付款</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-4">載入中...</p>
        ) : purchase ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-sm space-y-1">
              <p>採購單：{purchase.receive_code}</p>
              <p>合計：{formatNTD(purchase.total)}</p>
              <p>已付：{formatNTD(purchase.amt_paid)}</p>
              <p>未付：{formatNTD(purchase.amt_unpaid)}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-amt">付款金額</Label>
              <Input
                id="pay-amt"
                type="number"
                step="0.01"
                min="0.01"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="0"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '處理中...' : '確認付款'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground py-4">找不到採購單</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
