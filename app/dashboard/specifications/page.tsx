/**
 * Specifications List Page
 *
 * Displays all specifications for the current user with status badges and metadata.
 * Includes a button to create new specifications.
 */

import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { getSpecifications } from '@/app/actions/specifications';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type SpecificationRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: 'draft' | 'published' | 'archived';
  spec_data: any;
  ai_generated: boolean;
  ai_prompt: string | null;
  ai_model: string | null;
  tags: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

/**
 * Get status badge variant based on status
 */
function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  switch (status) {
    case 'published':
      return 'default';
    case 'draft':
      return 'secondary';
    case 'archived':
      return 'outline';
    default:
      return 'secondary';
  }
}

/**
 * Get status label in Traditional Chinese
 */
function getStatusLabel(status: string): string {
  switch (status) {
    case 'published':
      return '已發佈';
    case 'draft':
      return '草稿';
    case 'archived':
      return '已封存';
    default:
      return status;
  }
}

/**
 * Format date to locale string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default async function SpecificationsPage() {
  let specifications: SpecificationRow[] = [];
  let isAuthenticated = false;

  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      isAuthenticated = true;
      specifications = await getSpecifications() as SpecificationRow[];
    }
  } catch (error) {
    console.error('Failed to load specifications:', error);
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold">規格管理</h1>
            <p className="text-muted-foreground mt-2">
              建立和管理產品規格，支援自動化生成
            </p>
          </div>
          <Link href="/dashboard/specifications/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新增規格
            </Button>
          </Link>
        </div>
      </div>

      {!isAuthenticated ? (
        <EmptyState
          icon={FileText}
          title="請先登入"
          description="登入後即可管理規格"
        />
      ) : specifications.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="還沒有規格"
          description="建立第一個規格來開始"
          action={
            <Link href="/dashboard/specifications/new">
              <Button>建立新規格</Button>
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold text-sm">規格名稱</th>
                    <th className="text-left p-4 font-semibold text-sm">分類</th>
                    <th className="text-left p-4 font-semibold text-sm">狀態</th>
                    <th className="text-left p-4 font-semibold text-sm">建立日期</th>
                    <th className="text-right p-4 font-semibold text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {specifications.map((spec) => (
                    <tr key={spec.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <Link
                          href={`/dashboard/specifications/${spec.id}`}
                          className="font-medium hover:underline text-primary"
                        >
                          {spec.title}
                        </Link>
                        {spec.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {spec.description}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-sm">
                        {spec.category || '-'}
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusBadgeVariant(spec.status)}>
                          {getStatusLabel(spec.status)}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        {formatDate(spec.created_at)}
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/dashboard/specifications/${spec.id}`}>
                          <Button variant="ghost" size="sm">
                            編輯
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
