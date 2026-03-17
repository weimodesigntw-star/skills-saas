/**
 * 本機匯入腳本：讀取庫存總表.xlsx → 寫入 Supabase products
 *
 * 使用方式：
 *   cd ~/Downloads/skills
 *   IMPORT_USER_ID="b3e3b483-66d0-41c0-afab-297bc2003ff8" \
 *     npx tsx scripts/import-products.ts ~/Downloads/庫存總表.xlsx
 */

import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const USER_ID = process.env.IMPORT_USER_ID!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !USER_ID) {
    console.error('缺少環境變數：NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / IMPORT_USER_ID');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const filePath = process.argv[2];
  if (!filePath) {
    console.error('請提供 Excel 路徑');
    process.exit(1);
  }

  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error('找不到檔案：' + absPath);
    process.exit(1);
  }

  console.log('讀取檔案：' + absPath);
  const wb = XLSX.readFile(absPath);
  const ws = wb.Sheets[wb.SheetNames[0]];

  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headerRowIndex = rawRows.findIndex(
    (row) => Array.isArray(row) && row.includes('產品名稱')
  );

  if (headerRowIndex === -1) {
    console.error('找不到「產品名稱」欄位');
    process.exit(1);
  }

  console.log('Header 在第 ' + (headerRowIndex + 1) + ' 列');

  const parsed = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex });
  console.log('解析到 ' + parsed.length + ' 列資料');

  const cleanedRows: {
    name: string;
    productCode: string;
    categoryName: string;
    unit: string;
    price: number;
    qty: number;
    isActive: boolean;
    spec: string;
    color: string;
  }[] = [];
  const categoryNameSet = new Set<string>();
  let skipped = 0;

  for (const row of parsed as any[]) {
    const name = String(row['產品名稱'] ?? '').trim();
    if (!name) { skipped++; continue; }

    const productCode = String(row['產品代碼'] ?? '').trim();
    const categoryName = String(row['產品類別名稱'] ?? '').trim();
    const unit = String(row['單位'] ?? row['標準單位'] ?? '').trim();
    const spec = String(row['規格'] ?? '').trim();
    const color = String(row['顏色'] ?? '').trim();
    const qty = parseFloat(String(row['數量'] ?? '0')) || 0;
    const amount = parseFloat(String(row['金額'] ?? '0')) || 0;
    const unitPrice = qty > 0 ? Math.round(amount / qty) : 0;
    const price = unitPrice || Number(row['零售價']) || 0;
    const isActive = String(row['停用'] ?? '') !== '1';

    if (categoryName) categoryNameSet.add(categoryName);
    cleanedRows.push({ name, productCode, categoryName, unit, price, qty, isActive, spec, color });
  }

  console.log('有效資料 ' + cleanedRows.length + ' 筆，跳過空白 ' + skipped + ' 筆');

  const categoryMap = new Map<string, string>();
  const categoryNames = Array.from(categoryNameSet);

  if (categoryNames.length > 0) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', USER_ID)
      .in('name', categoryNames);

    existing?.forEach((c) => categoryMap.set(c.name as string, c.id as string));

    const missing = categoryNames.filter((n) => !categoryMap.has(n));
    if (missing.length > 0) {
      const { data: inserted, error } = await supabase
        .from('categories')
        .insert(missing.map((name) => ({ user_id: USER_ID, name })))
        .select('id, name');
      if (error) console.warn('建立分類部分失敗：', error.message);
      inserted?.forEach((c) => categoryMap.set(c.name as string, c.id as string));
    }
    console.log('分類處理完成（' + categoryNames.length + ' 個）');
  }

  const BATCH = 500;
  let success = 0;
  let failed = 0;

  // ── 為同一 productCode 的多筆資料產生唯一後綴（例如 P001-1, P001-2）────
  const withCodeBase = cleanedRows.filter((r) => r.productCode);
  const withCode: typeof cleanedRows = [];

  const codeCounter = new Map<string, number>();
  for (const row of withCodeBase) {
    const base = row.productCode;
    const count = (codeCounter.get(base) ?? 0) + 1;
    codeCounter.set(base, count);
    const uniqueCode = count === 1 ? base : `${base}-${count}`;
    withCode.push({ ...row, productCode: uniqueCode });
  }

  const withoutCode = cleanedRows.filter((r) => !r.productCode);

  console.log('開始匯入（有代碼 ' + withCode.length + ' 筆，無代碼 ' + withoutCode.length + ' 筆）');

  for (let i = 0; i < withCode.length; i += BATCH) {
    const batch = withCode.slice(i, i + BATCH).map((r) => ({
      user_id: USER_ID,
      // name 加上規格／顏色以利辨識
      name: [r.name, r.spec, r.color].filter(Boolean).join(' '),
      product_code: r.productCode,
      unit_name: r.unit || null,
      price: r.price,
      stock: r.qty,
      category_id: r.categoryName ? categoryMap.get(r.categoryName) ?? null : null,
      is_active: r.isActive,
      low_stock_threshold: 5,
      whole_sell_price: 0,
      purchase_price: 0,
    }));
    const { error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'user_id,product_code' });
    if (error) {
      console.error('upsert 失敗：', error.message);
      failed += batch.length;
    } else {
      success += batch.length;
      process.stdout.write('\r進度：' + (success + failed) + ' / ' + cleanedRows.length);
    }
  }

  for (let i = 0; i < withoutCode.length; i += BATCH) {
    const batch = withoutCode.slice(i, i + BATCH).map((r) => ({
      user_id: USER_ID,
      name: [r.name, r.spec, r.color].filter(Boolean).join(' '),
      unit_name: r.unit || null,
      price: r.price,
      stock: r.qty,
      category_id: r.categoryName ? categoryMap.get(r.categoryName) ?? null : null,
      is_active: r.isActive,
      low_stock_threshold: 5,
      whole_sell_price: 0,
      purchase_price: 0,
    }));
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error('insert 失敗：', error.message);
      failed += batch.length;
    } else {
      success += batch.length;
      process.stdout.write('\r進度：' + (success + failed) + ' / ' + cleanedRows.length);
    }
  }

  console.log('\n\n完成！成功 ' + success + ' 筆，失敗 ' + failed + ' 筆');
}

main().catch((err) => {
  console.error('執行錯誤：', err);
  process.exit(1);
});

