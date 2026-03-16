import { fetchShipments } from '@/app/actions/shipments';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { ShipmentsClient } from './ShipmentsClient';
import { Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
};

export default async function ShipmentsPage({
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
          icon={Truck}
          title="請先登入"
          description="登入後即可管理出貨單"
        />
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const { shipments, total, pageSize } = await fetchShipments({
    status: params.status,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize: 20,
  });

  return (
    <ShipmentsClient
      initialShipments={shipments}
      total={total}
      page={page}
      pageSize={pageSize}
    />
  );
}
