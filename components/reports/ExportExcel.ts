'use client';

import * as XLSX from 'xlsx';

/** 出貨明細表 Excel：標題行 + 資料 + 合計列 */
export function exportShipmentReport(data: Record<string, unknown>[], filename: string) {
  const wb = XLSX.utils.book_new();
  const rows = data.map((row: Record<string, unknown>) => ({
    '出貨日期': (row.shipments as Record<string, unknown>)?.ship_date ?? '',
    '出貨單號': (row.shipments as Record<string, unknown>)?.ship_code ?? '',
    '客戶代碼': ((row.shipments as Record<string, unknown>)?.members as Record<string, unknown>)?.client_code ?? '',
    '客戶名稱': ((row.shipments as Record<string, unknown>)?.members as Record<string, unknown>)?.name ?? '',
    '品名': row.product_name ?? '',
    '數量': Number(row.qty ?? 0),
    '單價': Number(row.unit_price ?? 0),
    '小計': Number(row.subtotal ?? 0),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const lastRow = rows.length + 2;
  (ws['!ref'] as string) = `A1:H${Math.max(lastRow - 1, 2)}`;
  ws[`E${lastRow}`] = { v: '合計', t: 's' };
  ws[`F${lastRow}`] = { f: `SUM(F2:F${lastRow - 1})`, t: 'n' };
  ws[`H${lastRow}`] = { f: `SUM(H2:H${lastRow - 1})`, t: 'n' };
  ws['!ref'] = `A1:H${lastRow}`;
  ws['!cols'] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, '出貨明細表');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** 毛利報表 Excel：銷售、成本、毛利、毛利率 */
export function exportProfitReport(data: Record<string, unknown>[], filename: string) {
  const wb = XLSX.utils.book_new();
  const rows = data.map((row: Record<string, unknown>) => {
    const qty = Number(row.qty ?? 0);
    const purchasePrice = Number((row.products as Record<string, unknown>)?.purchase_price ?? 0);
    const cost = qty * purchasePrice;
    const sales = Number(row.subtotal ?? 0);
    const profit = sales - cost;
    const margin = sales > 0 ? ((profit / sales) * 100).toFixed(1) + '%' : '—';
    return {
      '出貨日期': (row.shipments as Record<string, unknown>)?.ship_date ?? '',
      '出貨單號': (row.shipments as Record<string, unknown>)?.ship_code ?? '',
      '客戶名稱': ((row.shipments as Record<string, unknown>)?.members as Record<string, unknown>)?.name ?? '',
      '品名': row.product_name ?? '',
      '數量': qty,
      '出貨單價': Number(row.unit_price ?? 0),
      '採購單價': purchasePrice,
      '銷售金額': sales,
      '成本': cost,
      '毛利': profit,
      '毛利率': margin,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Array(11).fill({ wch: 12 });
  XLSX.utils.book_append_sheet(wb, ws, '毛利報表');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** 應收帳款明細表 Excel：合計、已收、未收、收款率 */
export function exportReceivableReport(data: Record<string, unknown>[], filename: string) {
  const wb = XLSX.utils.book_new();
  const rows = data.map((row: Record<string, unknown>) => {
    const total = Number(row.total ?? 0);
    const amtRecd = Number(row.amt_recd ?? 0);
    const rate = total > 0 ? ((amtRecd / total) * 100).toFixed(1) + '%' : '—';
    return {
      '出貨日期': row.ship_date ?? '',
      '出貨單號': row.ship_code ?? '',
      '客戶名稱': (row.members as Record<string, unknown>)?.name ?? '',
      '合計': total,
      '已收款': amtRecd,
      '未收款': Number(row.amt_outstanding ?? 0),
      '收款率': rate,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Array(7).fill({ wch: 14 });
  XLSX.utils.book_append_sheet(wb, ws, '應收帳款明細表');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
