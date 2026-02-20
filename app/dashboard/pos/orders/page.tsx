'use client';

/**
 * Order History Page
 *
 * Displays POS orders in a table with:
 * - Pagination
 * - Date range filtering
 * - Status badges
 * - Click to view details
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function OrdersPage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold">訂單列表</h1>
      <p className="text-muted-foreground mt-2">POS 訂單紀錄</p>
    </div>
  );
}
