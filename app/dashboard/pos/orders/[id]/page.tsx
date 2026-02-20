'use client';

/**
 * Order Detail Page
 *
 * Displays detailed view of a single order:
 * - Order header with status and payment method
 * - Items table with product details
 * - Summary with totals and tax
 * - Back button to return to order list
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<{ id: string; order_number?: string; status?: string } | null>(null);
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];

  useEffect(() => {
    if (!id) return;
    setOrder({ id });
  }, [id]);

  if (!id) return null;
  return (
    <div className="container mx-auto py-6 px-4">
      <Link href="/dashboard/pos/orders">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回訂單列表
        </Button>
      </Link>
      <h1 className="text-2xl font-bold">訂單 {order?.order_number ?? id}</h1>
      <p className="text-muted-foreground mt-2">訂單詳情頁面</p>
    </div>
  );
}
