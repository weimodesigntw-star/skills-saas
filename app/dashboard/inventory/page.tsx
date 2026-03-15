'use client';

/**
 * 庫存管理（Dashboard 主選單進入，側欄可見）
 */

import { InventoryPageContent } from '@/components/dashboard/InventoryPageContent';

export default function InventoryPage() {
  return <InventoryPageContent backHref="/dashboard" />;
}
