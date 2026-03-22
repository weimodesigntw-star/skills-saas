import { fetchPurchaseOrders } from '@/app/actions/purchase-orders';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { PurchasesClient } from './PurchasesClient';
import { ShoppingCart } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = {
  vendorId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  sort?: string;
  dir?: string;
};

const PURCHASE_SORT = ['receive_day', 'total', 'amt_unpaid', 'created_at'] as const;

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState icon={ShoppingCart} title="請先登入" description="登入後即可管理採購單" />
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sortBy = PURCHASE_SORT.includes(params.sort as (typeof PURCHASE_SORT)[number])
    ? (params.sort as (typeof PURCHASE_SORT)[number])
    : 'created_at';
  const sortDir = params.dir === 'asc' ? 'asc' : 'desc';

  const { purchases, total, pageSize } = await fetchPurchaseOrders({
    vendorId: params.vendorId,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize: 20,
    sortBy,
    sortDir,
  });

  return (
    <PurchasesClient
      initialPurchases={purchases}
      total={total}
      page={page}
      pageSize={pageSize}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );
}
