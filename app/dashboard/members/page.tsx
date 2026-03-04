import { Users } from 'lucide-react';
import { getMembersList, getMemberStats } from '@/app/actions/members';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { MemberManager } from '@/components/members/MemberManager';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  try {
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

    const [members, stats] = await Promise.all([
      getMembersList(),
      getMemberStats(),
    ]);

    return <MemberManager initialMembers={members} stats={stats} />;
  } catch (error: any) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Users}
          title="載入失敗"
          description={error.message || '無法載入會員列表'}
        />
      </div>
    );
  }
}
