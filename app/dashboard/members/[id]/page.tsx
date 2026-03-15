import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { fetchMemberById, fetchMemberOrders } from '@/app/actions/customer-members';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { formatNTD } from '@/lib/constants';
import { MemberDialogWrapper } from './MemberDialogWrapper';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export default async function MemberDetailPage({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState
          icon={Users}
          title="請先登入"
          description="登入後即可查看會員"
        />
      </div>
    );
  }

  const { id } = params;
  const member = await fetchMemberById(id);
  if (!member) notFound();

  let orders: { id: string; order_number: string; total_amount: number; status: string; created_at: string }[] = [];
  try {
    orders = await fetchMemberOrders(id);
  } catch {
    orders = [];
  }

  const createdDate = member.created_at
    ? new Date(member.created_at).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '—';

  const lastOrderDate =
    orders.length > 0 && orders[0].created_at
      ? new Date(orders[0].created_at).toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
      : '—';

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回會員列表
      </Link>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-xl">{member.name}</CardTitle>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {member.phone && <p>電話：{member.phone}</p>}
              {member.email && <p>Email：{member.email}</p>}
              {member.birthday && <p>生日：{member.birthday}</p>}
              {member.note && <p>備註：{member.note}</p>}
            </div>
          </div>
          <MemberDialogWrapper member={member} />
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">累計消費</p>
            <p className="text-lg font-semibold">{formatNTD(Number(member.total_spent))}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">消費次數</p>
            <p className="text-lg font-semibold">{member.visit_count} 次</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">上次消費</p>
            <p className="text-lg font-semibold">{lastOrderDate}</p>
          </div>
          <div className="sm:col-span-3">
            <p className="text-sm text-muted-foreground">加入日期</p>
            <p className="font-medium">{createdDate}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>消費紀錄</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              尚無消費紀錄
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">訂單編號</th>
                    <th className="text-left py-2 font-semibold">日期</th>
                    <th className="text-right py-2 font-semibold">金額</th>
                    <th className="text-left py-2 font-semibold">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b">
                      <td className="py-2 font-mono">{order.order_number}</td>
                      <td className="py-2 text-muted-foreground">
                        {order.created_at
                          ? new Date(order.created_at).toLocaleDateString('zh-TW')
                          : '—'}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {formatNTD(Number(order.total_amount))}
                      </td>
                      <td className="py-2">{order.status ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
