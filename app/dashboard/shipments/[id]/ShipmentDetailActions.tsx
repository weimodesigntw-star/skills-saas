'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DollarSign, Ban } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { voidShipment } from '@/app/actions/shipments';
import { toast } from '@/components/ui/toast';
import { ReceivePaymentDialog } from '@/components/shipments/ReceivePaymentDialog';

type Shipment = {
  id: string;
  status: string;
  amt_outstanding: number;
};

export function ShipmentDetailActions({ shipment }: { shipment: Shipment }) {
  const router = useRouter();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const handleVoid = async () => {
    setVoiding(true);
    const result = await voidShipment(shipment.id);
    setVoiding(false);
    setVoidOpen(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('出貨單已作廢');
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      {shipment.status === 'valid' && Number(shipment.amt_outstanding) > 0 && (
        <Button variant="outline" size="sm" onClick={() => setReceiveOpen(true)}>
          <DollarSign className="h-4 w-4 mr-1" />
          收款
        </Button>
      )}
      {shipment.status === 'valid' && (
        <Button variant="outline" size="sm" onClick={() => setVoidOpen(true)} className="text-destructive hover:text-destructive">
          <Ban className="h-4 w-4 mr-1" />
          作廢
        </Button>
      )}
      <ConfirmDialog
        open={voidOpen}
        onOpenChange={setVoidOpen}
        title="確認作廢"
        description="確定要作廢此出貨單嗎？將回補庫存並還原訂單狀態。"
        onConfirm={handleVoid}
        loading={voiding}
      />
      {receiveOpen && (
        <ReceivePaymentDialog
          shipmentId={shipment.id}
          open={receiveOpen}
          onOpenChange={setReceiveOpen}
          onSuccess={() => {
            setReceiveOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
