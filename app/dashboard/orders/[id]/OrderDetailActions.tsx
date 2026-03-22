'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Copy } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteCustomerOrder } from '@/app/actions/customer-orders';
import { toast } from '@/components/ui/toast';
import { useState } from 'react';

interface OrderDetailActionsProps {
  orderId: string;
}

export function OrderDetailActions({ orderId }: OrderDetailActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    const result = await deleteCustomerOrder(orderId);
    setDeleting(false);
    setDeleteOpen(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success('訂單已刪除');
    router.push('/dashboard/orders');
    router.refresh();
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/orders/new?cloneFrom=${orderId}`}>
          <Copy className="h-4 w-4 mr-1" />
          複製訂單
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/orders/${orderId}/edit`}>
          <Pencil className="h-4 w-4 mr-1" />
          編輯
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4 mr-1" />
        刪除
      </Button>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="確認刪除"
        description="確定要刪除此訂單嗎？明細將一併刪除，此操作無法復原。"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}
