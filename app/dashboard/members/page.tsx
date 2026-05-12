import { fetchMembers } from '@/app/actions/customer-members';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthAndWorkspace } from '@/lib/workspace';
import { EmptyState } from '@/components/ui/empty-state';
import { MembersClient } from './MembersClient';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MEMBER_SORT = ['created_at', 'name', 'total_spent', 'order_count'] as const;
const PAGE_SIZES = [10, 20, 50, 100] as const;

interface PageProps {
  searchParams: {
    search?: string;
    page?: string;
    sort?: string;
    dir?: string;
    pageSize?: string;
  };
}

export default async function MembersPage({ searchParams }: PageProps) {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);

  if (!ownerId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Users}
          title="請先登入"
          description="登入後即可管理會員"
        />
      </div>
    );
  }

  const page = Math.max(1, Number(searchParams.page) || 1);
  const rawSize = Number(searchParams.pageSize);
  const pageSize = PAGE_SIZES.includes(rawSize as (typeof PAGE_SIZES)[number]) ? rawSize : 20;
  const sortBy = MEMBER_SORT.includes(searchParams.sort as (typeof MEMBER_SORT)[number])
    ? (searchParams.sort as (typeof MEMBER_SORT)[number])
    : 'created_at';
  const sortDir = searchParams.dir === 'asc' ? 'asc' : 'desc';

  const { members, total, pageSize: resolvedSize } = await fetchMembers({
    search: searchParams.search,
    page,
    pageSize,
    sortBy,
    sortDir,
  });

  const { data: customersSyncState } = await supabase
    .from('easystore_sync_state')
    .select('last_synced_at, synced_count')
    .eq('user_id', ownerId)
    .eq('resource', 'customers')
    .maybeSingle();

  return (
    <MembersClient
      initialMembers={members}
      total={total}
      page={page}
      pageSize={resolvedSize}
      sortBy={sortBy}
      sortDir={sortDir}
      lastSyncedAt={(customersSyncState?.last_synced_at as string | null) ?? null}
      lastSyncedCount={(customersSyncState?.synced_count as number | null) ?? null}
    />
  );
}
