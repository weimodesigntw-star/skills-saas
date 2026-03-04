import { notFound } from 'next/navigation';
import { Users } from 'lucide-react';
import { getMemberById } from '@/app/actions/members';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { MemberEditor } from '@/components/members/MemberEditor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function EditMemberPage({ params }: PageProps) {
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

    const member = await getMemberById(params.id);

    return <MemberEditor member={member} />;
  } catch (error: any) {
    if (error.message === 'Member not found') {
      notFound();
    }

    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Users}
          title="載入失敗"
          description={error.message || '無法載入會員資料'}
        />
      </div>
    );
  }
}
