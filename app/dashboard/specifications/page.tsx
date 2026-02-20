/**
 * Specifications List Page
 *
 * Displays all specifications for the current user with status badges and metadata.
 * Includes a button to create new specifications.
 */

import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SpecificationsPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">規格管理</h1>
        <Button asChild>
          <Link href="/dashboard/specifications/new">
            <Plus className="h-4 w-4 mr-2" />
            新增規格
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground">規格列表</p>
    </div>
  );
}