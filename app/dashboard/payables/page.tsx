import { fetchPayableWriteoffs } from '@/app/actions/payable-writeoffs';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { PayablesClient } from './PayablesClient';
import { CreditCard } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = { vendorId?: string; dateFrom?: string; dateTo?: string; page?: string };

export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState icon={CreditCard} title="請先登入" description="登入後即可管理應付沖帳" />
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { writeoffs, total, pageSize } = await fetchPayableWriteoffs({
    vendorId: params.vendorId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize: 20,
  });

  return (
    <PayablesClient
      initialWriteoffs={writeoffs}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  );
}
