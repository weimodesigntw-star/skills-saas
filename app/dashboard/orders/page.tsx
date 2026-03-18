import { fetchCustomerOrders } from '@/app/actions/customer-orders';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { OrdersClient } from './OrdersClient';
import { ClipboardList } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = {
  search?: string;
  customerName?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={ClipboardList}
          title="請先登入"
          description="登入後即可管理客戶訂單"
        />
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { orders, total, pageSize } = await fetchCustomerOrders({
    search: params.search,
    customerName: params.customerName,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize: 20,
  });

  return (
    <OrdersClient
      initialOrders={orders}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  );
}
