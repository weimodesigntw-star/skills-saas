'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil } from 'lucide-react';
import { MemberDialog } from '@/components/members/MemberDialog';
import type { CustomerMember } from '@/app/actions/customer-members';

export function MemberDialogWrapper({ member }: { member: CustomerMember }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4 mr-1" />
        編輯
      </Button>
      <MemberDialog open={open} onOpenChange={setOpen} member={member} onSuccess={handleSuccess} />
    </>
  );
}
