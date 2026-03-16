import { getPurchaseCodePreview } from '@/app/actions/purchase-orders';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewPurchasePage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const codePreview = await getPurchaseCodePreview();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/dashboard/purchases"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回採購單列表
      </Link>
      <h1 className="text-2xl font-bold mb-6">新增採購單</h1>
      <PurchaseForm codePreview={codePreview ?? 'CA202-YYYYMMDD-0001'} />
    </div>
  );
}
