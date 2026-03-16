import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ShipmentForm } from '@/components/shipments/ShipmentForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewShipmentPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/dashboard/shipments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回出貨單列表
      </Link>
      <h1 className="text-2xl font-bold mb-6">新增出貨單（手動）</h1>
      <ShipmentForm />
    </div>
  );
}
