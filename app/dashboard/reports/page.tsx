/**
 * 報表中心 — 出貨明細表、毛利報表、應收帳款明細表，支援 Excel 匯出
 */

import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  return <ReportsClient />;
}
