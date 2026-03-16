'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DollarSign, Ban } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { voidPurchaseOrder } from '@/app/actions/purchase-orders';
import { toast } from '@/components/ui/toast';
import { PayPurchaseDialog } from '@/components/purchases/PayPurchaseDialog';

type Purchase = {
  id: string;
  status: string;
  amt_unpaid: number;
};

export function PurchaseDetailActions({ purchase }: { purchase: Purchase }) {
  const router = useRouter();
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const handleVoid = async () => {
    setVoiding(true);
    const result = await voidPurchaseOrder(purchase.id);
    setVoiding(false);
    setVoidOpen(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('採購單已作廢');
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      {purchase.status === 'valid' && Number(purchase.amt_unpaid) > 0 && (
        <Button variant="outline" size="sm" onClick={() => setPayOpen(true)}>
          <DollarSign className="h-4 w-4 mr-1" />
          付款
        </Button>
      )}
      {purchase.status === 'valid' && (
        <Button variant="outline" size="sm" onClick={() => setVoidOpen(true)} className="text-destructive hover:text-destructive">
          <Ban className="h-4 w-4 mr-1" />
          作廢
        </Button>
      )}
      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="確認作廢"
        description="確定要作廢此採購單嗎？將回補庫存。"
        onConfirm={handleVoid}
        loading={voiding}
      />
      {payOpen && (
        <PayPurchaseDialog
          purchaseId={purchase.id}
          open={payOpen}
          onOpenChange={setPayOpen}
          onSuccess={() => {
            setPayOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
