import { fetchWriteoffs } from '@/app/actions/receivable-writeoffs';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { ReceivablesClient } from './ReceivablesClient';
import { Receipt } from 'lucide-react';

export const dynamic = 'force-dynamic';

type SearchParams = {
  memberId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: string;
  sort?: string;
  dir?: string;
};

const WRITEOFF_SORT = [
  'writeoff_code',
  'writeoff_date',
  'total_charge',
  'discount',
  'actual_recd',
  'created_at',
] as const;

export default async function ReceivablesPage({
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
          icon={Receipt}
          title="請先登入"
          description="登入後即可管理應收沖帳"
        />
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sortBy = WRITEOFF_SORT.includes(params.sort as (typeof WRITEOFF_SORT)[number])
    ? (params.sort as (typeof WRITEOFF_SORT)[number])
    : 'created_at';
  const sortDir = params.dir === 'asc' ? 'asc' : 'desc';

  const { writeoffs, total, pageSize } = await fetchWriteoffs({
    memberId: params.memberId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    page,
    pageSize: 20,
    sortBy,
    sortDir,
  });

  return (
    <ReceivablesClient
      initialWriteoffs={writeoffs}
      total={total}
      page={page}
      pageSize={pageSize}
      sortBy={sortBy}
      sortDir={sortDir}
    />
  );
}
