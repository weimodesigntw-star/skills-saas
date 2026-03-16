import { getOrderCodePreview } from '@/app/actions/customer-orders';
import { createServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { NewOrderForm } from './NewOrderForm';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const orderCodePreview = await getOrderCodePreview();

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">新增客戶訂單</h1>
      <NewOrderForm orderCodePreview={orderCodePreview ?? ''} />
    </div>
  );
}
