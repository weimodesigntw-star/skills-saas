'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchMembers } from '@/app/actions/customer-members';
import {
  fetchShipmentReport,
  fetchProfitReport,
  fetchReceivableReport,
  type ShipmentReportRow,
  type ProfitReportRow,
  type ReceivableReportRow,
} from '@/app/actions/reports';
import {
  exportShipmentReport,
  exportProfitReport,
  exportReceivableReport,
} from '@/components/reports/ExportExcel';
import { formatNTD } from '@/lib/constants';
import { Search, FileDown } from 'lucide-react';
import { MemberCombobox } from '@/components/ui/member-combobox';

type TabId = 'shipment' | 'profit' | 'receivable';

const TAB_LABELS: Record<TabId, string> = {
  shipment: '出貨明細表',
  profit: '毛利報表',
  receivable: '應收帳款明細表',
};

export function ReportsClient() {
  const [activeTab, setActiveTab] = useState<TabId>('shipment');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [memberId, setMemberId] = useState('');
  const [members, setMembers] = useState<{ id: string; name: string; client_code: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [shipmentData, setShipmentData] = useState<ShipmentReportRow[]>([]);
  const [profitData, setProfitData] = useState<ProfitReportRow[]>([]);
  const [receivableData, setReceivableData] = useState<ReceivableReportRow[]>([]);

  useEffect(() => {
    fetchMembers({ pageSize: 500 }).then((r) =>
      setMembers((r.members ?? []) as { id: string; name: string; client_code: string | null }[])
    );
  }, []);

  const params = {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    memberId: memberId || undefined,
  };

  async function handleQuery() {
    setLoading(true);
    try {
      if (activeTab === 'shipment') {
        const data = await fetchShipmentReport(params);
        setShipmentData(data);
      } else if (activeTab === 'profit') {
        const data = await fetchProfitReport(params);
        setProfitData(data);
      } else {
        const data = await fetchReceivableReport(params);
        setReceivableData(data);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const baseName = `報表_${dateFrom || '全部'}_${dateTo || '全部'}`;
    if (activeTab === 'shipment') {
      exportShipmentReport(shipmentData as unknown as Record<string, unknown>[], baseName + '_出貨明細');
    } else if (activeTab === 'profit') {
      exportProfitReport(profitData as unknown as Record<string, unknown>[], baseName + '_毛利');
    } else {
      exportReceivableReport(receivableData as unknown as Record<string, unknown>[], baseName + '_應收');
    }
  }

  const currentData =
    activeTab === 'shipment' ? shipmentData.length : activeTab === 'profit' ? profitData.length : receivableData.length;
  const hasData = currentData > 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">報表匯出</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-6">
        {(['shipment', 'profit', 'receivable'] as TabId[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* 共用篩選 */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <span className="text-sm text-muted-foreground">出貨日期起</span>
        <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-sm text-muted-foreground">出貨日期迄</span>
        <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <span className="text-sm text-muted-foreground">客戶</span>
        <MemberCombobox
          members={members}
          value={memberId}
          onChange={setMemberId}
          placeholder="搜尋報表客戶"
          allLabel="全部客戶"
        />
        <Button variant="outline" onClick={handleQuery} disabled={loading}>
          <Search className="h-4 w-4 mr-1" />
          查詢
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={!hasData}>
          <FileDown className="h-4 w-4 mr-1" />
          匯出 Excel
        </Button>
      </div>

      {/* 資料表格 */}
      <div className="rounded-md border overflow-x-auto">
        {activeTab === 'shipment' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-3 font-semibold">出貨日期</th>
                <th className="text-left py-3 px-3 font-semibold">出貨單號</th>
                <th className="text-left py-3 px-3 font-semibold">客戶代碼</th>
                <th className="text-left py-3 px-3 font-semibold">客戶名稱</th>
                <th className="text-left py-3 px-3 font-semibold">品名</th>
                <th className="text-right py-3 px-3 font-semibold">數量</th>
                <th className="text-right py-3 px-3 font-semibold">單價</th>
                <th className="text-right py-3 px-3 font-semibold">小計</th>
              </tr>
            </thead>
            <tbody>
              {shipmentData.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    請選擇條件後按「查詢」
                  </td>
                </tr>
              )}
              {shipmentData.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-3">{row.shipments?.ship_date ?? '—'}</td>
                  <td className="py-2 px-3 font-mono text-xs">{row.shipments?.ship_code ?? '—'}</td>
                  <td className="py-2 px-3">{row.shipments?.members?.client_code ?? '—'}</td>
                  <td className="py-2 px-3">{row.shipments?.members?.name ?? '—'}</td>
                  <td className="py-2 px-3">{row.product_name}</td>
                  <td className="py-2 px-3 text-right">{Number(row.qty)}</td>
                  <td className="py-2 px-3 text-right">{formatNTD(Number(row.unit_price))}</td>
                  <td className="py-2 px-3 text-right">{formatNTD(Number(row.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'profit' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-3 font-semibold">出貨日期</th>
                <th className="text-left py-3 px-3 font-semibold">出貨單號</th>
                <th className="text-left py-3 px-3 font-semibold">客戶名稱</th>
                <th className="text-left py-3 px-3 font-semibold">品名</th>
                <th className="text-right py-3 px-3 font-semibold">數量</th>
                <th className="text-right py-3 px-3 font-semibold">出貨單價</th>
                <th className="text-right py-3 px-3 font-semibold">採購單價</th>
                <th className="text-right py-3 px-3 font-semibold">銷售金額</th>
                <th className="text-right py-3 px-3 font-semibold">成本</th>
                <th className="text-right py-3 px-3 font-semibold">毛利</th>
                <th className="text-right py-3 px-3 font-semibold">毛利率</th>
              </tr>
            </thead>
            <tbody>
              {profitData.length === 0 && !loading && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-muted-foreground">
                    請選擇條件後按「查詢」
                  </td>
                </tr>
              )}
              {profitData.map((row, idx) => {
                const cost = Number(row.qty) * Number(row.products?.purchase_price ?? 0);
                const sales = Number(row.subtotal);
                const profit = sales - cost;
                const margin = sales > 0 ? ((profit / sales) * 100).toFixed(1) + '%' : '—';
                return (
                  <tr key={idx} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3">{row.shipments?.ship_date ?? '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs">{row.shipments?.ship_code ?? '—'}</td>
                    <td className="py-2 px-3">{row.shipments?.members?.name ?? '—'}</td>
                    <td className="py-2 px-3">{row.product_name}</td>
                    <td className="py-2 px-3 text-right">{Number(row.qty)}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(Number(row.unit_price))}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(Number(row.products?.purchase_price ?? 0))}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(sales)}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(cost)}</td>
                    <td className={`py-2 px-3 text-right ${profit < 0 ? 'text-red-600' : ''}`}>{formatNTD(profit)}</td>
                    <td className="py-2 px-3 text-right">{margin}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {activeTab === 'receivable' && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-3 px-3 font-semibold">出貨日期</th>
                <th className="text-left py-3 px-3 font-semibold">出貨單號</th>
                <th className="text-left py-3 px-3 font-semibold">客戶名稱</th>
                <th className="text-right py-3 px-3 font-semibold">合計</th>
                <th className="text-right py-3 px-3 font-semibold">已收款</th>
                <th className="text-right py-3 px-3 font-semibold">未收款</th>
                <th className="text-right py-3 px-3 font-semibold">收款率</th>
              </tr>
            </thead>
            <tbody>
              {receivableData.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    請選擇條件後按「查詢」
                  </td>
                </tr>
              )}
              {receivableData.map((row, idx) => {
                const total = Number(row.total);
                const rate = total > 0 ? ((Number(row.amt_recd) / total) * 100).toFixed(1) + '%' : '—';
                const outstanding = Number(row.amt_outstanding);
                return (
                  <tr
                    key={idx}
                    className={`border-b hover:bg-muted/30 ${outstanding > 0 ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                  >
                    <td className="py-2 px-3">{row.ship_date ?? '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs">{row.ship_code}</td>
                    <td className="py-2 px-3">{row.members?.name ?? '—'}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(total)}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(Number(row.amt_recd))}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(outstanding)}</td>
                    <td className="py-2 px-3 text-right">{rate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
