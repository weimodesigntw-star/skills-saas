'use client';

/**
 * 庫存管理（從 POS 進入，保留舊路徑相容）
 */

import { InventoryPageContent } from '@/components/dashboard/InventoryPageContent';

export default function PosInventoryPage() {
  return <InventoryPageContent backHref="/dashboard/pos" />;
}
