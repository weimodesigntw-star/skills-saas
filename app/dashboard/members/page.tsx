import { fetchMembers } from '@/app/actions/customer-members';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { MembersClient } from './MembersClient';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { search?: string; page?: string };
}

export default async function MembersPage({ searchParams }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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
  const { members, total, pageSize } = await fetchMembers({
    search: searchParams.search,
    page,
    pageSize: 20,
  });

  const { data: customersSyncState } = await supabase
    .from('easystore_sync_state')
    .select('last_synced_at, synced_count')
    .eq('user_id', user.id)
    .eq('resource', 'customers')
    .maybeSingle();

  return (
    <MembersClient
      initialMembers={members}
      total={total}
      page={page}
      pageSize={pageSize}
      lastSyncedAt={(customersSyncState?.last_synced_at as string | null) ?? null}
      lastSyncedCount={(customersSyncState?.synced_count as number | null) ?? null}
    />
  );
}
