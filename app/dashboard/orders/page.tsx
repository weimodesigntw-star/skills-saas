import { fetchCustomerOrders } from '@/app/actions/customer-orders';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { OrdersClient } from './OrdersClient';
import { ClipboardList } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = {
  q?: string;
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
    q: params.q,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize: 20,
  });

  // 讀上次增量同步時間
  const { data: syncState } = await supabase
    .from('easystore_sync_state')
    .select('last_synced_at, synced_count')
    .eq('user_id', user.id)
    .eq('resource', 'orders')
    .maybeSingle();

  return (
    <OrdersClient
      initialOrders={orders}
      total={total}
      page={page}
      pageSize={pageSize}
      lastSyncedAt={(syncState?.last_synced_at as string | null) ?? null}
      lastSyncedCount={(syncState?.synced_count as number | null) ?? null}
    />
  );
}
