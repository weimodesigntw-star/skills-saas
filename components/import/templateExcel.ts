'use client';

import * as XLSX from 'xlsx';

/** 產品資料範本標題（與 ERP 匯出一致） */
const PRODUCT_HEADERS = [
  '產品代碼',
  '產品名稱',
  '規格',
  '顏色',
  '產品性質',
  '標準單位',
  '標準單位換算率',
  '產品類別名稱',
  '零售價',
  '批發價',
  '採購單價',
  '停用',
];

/** 客戶資料範本標題（與 ERP 匯出一致） */
const MEMBER_HEADERS = [
  '客戶代碼',
  '客戶名稱',
  '客戶類別',
  '統一編號',
  '幣別',
  '稅別',
  '稅率',
  'Email',
  '電話',
  '縣市',
  '地區',
  '生日',
  '備註',
  '停用',
];

export function downloadProductTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([PRODUCT_HEADERS]);
  ws['!cols'] = PRODUCT_HEADERS.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, '產品資料');
  XLSX.writeFile(wb, '產品資料匯入範本.xlsx');
}

export function downloadMemberTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([MEMBER_HEADERS]);
  ws['!cols'] = MEMBER_HEADERS.map(() => ({ wch: 12 }));
  XLSX.utils.book_append_sheet(wb, ws, '客戶資料');
  XLSX.writeFile(wb, '客戶資料匯入範本.xlsx');
}
