import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchWriteoffById } from '@/app/actions/receivable-writeoffs';
import { createServerClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt } from 'lucide-react';
import { formatNTD } from '@/lib/constants';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WriteoffDetailPage({ params }: PageProps) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <EmptyState icon={Receipt} title="請先登入" description="登入後即可查看沖帳單" />
      </div>
    );
  }

  const { id } = await params;
  const writeoff = await fetchWriteoffById(id);
  if (!writeoff) notFound();

  const member = writeoff.members as { id: string; name: string; client_code: string | null } | null;
  const customerLabel = member ? (member.client_code ? `${member.name}（${member.client_code}）` : member.name) : '—';

  const items = (writeoff.items ?? []) as {
    ship_code: string;
    charge_amount: number;
    writeoff_amount: number;
    created_at?: string;
  }[];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/dashboard/receivables"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回應收沖帳列表
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl font-mono">{writeoff.writeoff_code}</CardTitle>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p>日期：{writeoff.writeoff_date}</p>
            <p>客戶：{customerLabel}</p>
            {writeoff.note && <p>備註：{writeoff.note}</p>}
          </div>
        </CardHeader>
        <CardContent className="border-t pt-4">
          <p className="text-sm font-medium text-muted-foreground mb-2">明細</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-semibold">單號（出貨／訂單）</th>
                  <th className="text-right py-2 font-semibold">應收金額</th>
                  <th className="text-right py-2 font-semibold">本次沖帳</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-2 font-mono">{row.ship_code}</td>
                    <td className="py-2 text-right">{formatNTD(Number(row.charge_amount))}</td>
                    <td className="py-2 text-right">{formatNTD(Number(row.writeoff_amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-1 text-sm text-right">
            <p>應收合計：{formatNTD(Number(writeoff.total_charge))}</p>
            <p>折讓：{formatNTD(Number(writeoff.discount))}</p>
            <p>動用預收：{formatNTD(Number(writeoff.prepaid_used))}</p>
            <p className="font-bold">實收金額：{formatNTD(Number(writeoff.actual_recd))}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
