import { fetchCustomerOrders } from '@/app/actions/customer-orders';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';
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
  sort?: string;
  dir?: string;
  pageSize?: string;
};

const ORDER_SORT = ['created_at', 'advance_date', 'total', 'order_code'] as const;
const PAGE_SIZES = [10, 20, 50, 100] as const;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);

  if (!ownerId) {
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
  const rawSize = Number(params.pageSize);
  const pageSize = PAGE_SIZES.includes(rawSize as (typeof PAGE_SIZES)[number]) ? rawSize : 20;
  const sortBy = ORDER_SORT.includes(params.sort as (typeof ORDER_SORT)[number])
    ? (params.sort as (typeof ORDER_SORT)[number])
    : 'created_at';
  const sortDir = params.dir === 'asc' ? 'asc' : 'desc';

  const { orders, total, pageSize: resolvedSize } = await fetchCustomerOrders({
    q: params.q,
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  // 讀上次增量同步時間
  const { data: syncState } = await supabase
    .from('easystore_sync_state')
    .select('last_synced_at, synced_count')
    .eq('user_id', ownerId)
    .eq('resource', 'orders')
    .maybeSingle();

  return (
    <OrdersClient
      initialOrders={orders}
      total={total}
      page={page}
      pageSize={resolvedSize}
      sortBy={sortBy}
      sortDir={sortDir}
      lastSyncedAt={(syncState?.last_synced_at as string | null) ?? null}
      lastSyncedCount={(syncState?.synced_count as number | null) ?? null}
    />
  );
}
