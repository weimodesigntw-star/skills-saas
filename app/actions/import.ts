'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getAuthAndWorkspace } from '@/lib/workspace';

/** ERP 產品資料列（Excel 標題對應，使用 ASCII key） */
export type ImportProductRow = {
  product_code?: string;
  product_name: string;
  spec?: string;
  color?: string;
  unit?: string;
  standard_unit?: string;
  category_name?: string;
  qty?: number | string;
  amount?: number | string;
  retail_price?: number | string;
  wholesale_price?: number | string;
  purchase_price?: number | string;
  disabled?: string | number;
};

/** ERP 客戶資料列（Excel 標題對應） */
export type ImportMemberRow = {
  客戶代碼?: string;
  客戶名稱: string;
  客戶類別?: string;
  統一編號?: string;
  幣別?: string;
  稅別?: string;
  稅率?: number | string;
  Email?: string;
  email?: string;
  電話?: string;
  備註?: string;
  停用?: string | number;
};

export type ImportResult = {
  success: number;
  failed: number;
  errors?: string[];
};

/** 批次匯入產品 */
export async function importProducts(rows: ImportProductRow[]): Promise<ImportResult | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  // 先整理資料與分類名稱，避免每列都打 DB
  const cleanedRows: {
    name: string;
    productCode: string;
    categoryName: string;
    spec: string;
    color: string;
    unit: string;
    price: number;
    wholePrice: number;
    purchasePrice: number;
    qty: number;
    isActive: boolean;
  }[] = [];

  const categoryNameSet = new Set<string>();

  for (const row of rows) {
    const name = (row.product_name ?? '').toString().trim();
    if (!name) {
      failed++;
      if (errors.length < 20) errors.push('跳過：缺少產品名稱');
      continue;
    }

    const productCode = row.product_code != null ? String(row.product_code).trim() : '';
    const categoryName = row.category_name != null ? String(row.category_name).trim() : '';
    const spec = (row.spec ?? '').toString().trim();
    const color = (row.color ?? '').toString().trim();
    const unitFromSheet = (row.unit ?? '').toString().trim();
    const standardUnit = (row.standard_unit ?? '').toString().trim();
    const qtyRaw = row.qty != null ? String(row.qty) : '0';
    const amountRaw = row.amount != null ? String(row.amount) : '0';
    const qty = parseFloat(qtyRaw) || 0;
    const amount = parseFloat(amountRaw) || 0;
    const unitPrice = qty > 0 ? Math.round(amount / qty) : 0;
    const disable = row.disabled != null ? String(row.disabled) : '';
    const isActive = disable !== '1';

    if (categoryName) categoryNameSet.add(categoryName);

    cleanedRows.push({
      name,
      productCode,
      categoryName,
      spec,
      color,
      unit: unitFromSheet || standardUnit,
      // 單價以 金額 ÷ 數量 反推，若數量為 0 則退回 Excel 的零售價
      price: unitPrice || Number(row.retail_price) || 0,
      wholePrice: Number(row.wholesale_price) || 0,
      purchasePrice: Number(row.purchase_price) || 0,
      qty,
      isActive,
    });
  }

  // 一次查出所有需要的分類
  const categoryMap = new Map<string, string>(); // name -> id
  const categoryNames = Array.from(categoryNameSet);

  if (categoryNames.length > 0) {
    const { data: existingCats } = await supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', ownerId)
      .in('name', categoryNames);

    existingCats?.forEach((c) => {
      categoryMap.set(c.name as string, c.id as string);
    });

    const missingNames = categoryNames.filter((n) => !categoryMap.has(n));
    if (missingNames.length > 0) {
      const toInsert = missingNames.map((name) => ({ user_id: ownerId, name }));
      const { data: inserted, error: catError } = await supabase
        .from('categories')
        .insert(toInsert)
        .select('id, name');
      if (catError) {
        if (errors.length < 20) errors.push(`建立分類失敗：${catError.message}`);
      } else {
        inserted?.forEach((c) => {
          categoryMap.set(c.name as string, c.id as string);
        });
      }
    }
  }

  // 準備要寫入 products 的 payload，拆成有 product_code 與沒有的兩組
  const payloadsWithCode: any[] = [];
  const payloadsWithoutCode: any[] = [];

  for (const row of cleanedRows) {
    const description = [row.spec, row.color].filter(Boolean).join(' ') || null;
    const categoryId = row.categoryName ? categoryMap.get(row.categoryName) ?? null : null;

    const payload = {
      user_id: ownerId,
      name: row.name,
      product_code: row.productCode || null,
      description,
      unit_name: row.unit || null,
      price: row.price,
      whole_sell_price: row.wholePrice,
      purchase_price: row.purchasePrice,
      category_id: categoryId,
      is_active: row.isActive,
      stock: row.qty,
      low_stock_threshold: 5,
    };

    if (row.productCode) {
      payloadsWithCode.push(payload);
    } else {
      payloadsWithoutCode.push(payload);
    }
  }

  const BATCH_SIZE = 300;

  // 1) 有 product_code 的，用 upsert（依 user_id + product_code 去重）
  for (let i = 0; i < payloadsWithCode.length; i += BATCH_SIZE) {
    const batch = payloadsWithCode.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('products')
      .upsert(batch, { onConflict: 'user_id,product_code' });
    if (error) {
      // 方便在 Vercel Logs 看到實際錯誤
      // eslint-disable-next-line no-console
      console.error('importProducts upsert error:', error.message, error.code, error.details);
      failed += batch.length;
      if (errors.length < 20) errors.push(`批次失敗（product_code）：${error.message}`);
    } else {
      success += batch.length;
    }
  }

  // 2) 沒有 product_code 的，單純 insert（避免重複 key）
  for (let i = 0; i < payloadsWithoutCode.length; i += BATCH_SIZE) {
    const batch = payloadsWithoutCode.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      failed += batch.length;
      if (errors.length < 20) errors.push(`批次失敗（無 product_code）：${error.message}`);
    } else {
      success += batch.length;
    }
  }

  revalidatePath('/dashboard/products');
  return { success, failed, errors: errors.slice(0, 20) };
}

/** 批次匯入會員 */
export async function importMembers(rows: ImportMemberRow[]): Promise<ImportResult | { error: string }> {
  const supabase = createServerClient();
  const { ownerId } = await getAuthAndWorkspace(supabase);
  if (!ownerId) return { error: '請先登入' };

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = (row.客戶名稱 ?? '').toString().trim();
    if (!name) {
      failed++;
      continue;
    }

    const clientCode = row.客戶代碼 != null ? String(row.客戶代碼).trim() : '';
    const disable = row.停用 != null ? String(row.停用) : '';
    const isActive = disable !== '1';

    const payload = {
      user_id: ownerId,
      name,
      client_code: clientCode || null,
      client_cat: (row.客戶類別 ?? '').toString().trim() || null,
      uniform_num: (row.統一編號 ?? '').toString().trim() || null,
      currency: (row.幣別 ?? '').toString().trim() || '台幣',
      tax_type: (row.稅別 ?? '').toString().trim() || null,
      taxrate: Number(row.稅率) || 0.05,
      email: (row.Email ?? row.email ?? '').toString().trim() || null,
      phone: (row.電話 ?? '').toString().trim() || null,
      note: (row.備註 ?? '').toString().trim() || null,
      is_active: isActive,
    };

    if (clientCode) {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', ownerId)
        .eq('client_code', clientCode)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from('members').update(payload).eq('id', existing.id);
        if (error) {
          failed++;
          errors.push(`${name}: ${error.message}`);
        } else {
          success++;
        }
      } else {
        const { error } = await supabase.from('members').insert(payload);
        if (error) {
          failed++;
          errors.push(`${name}: ${error.message}`);
        } else {
          success++;
        }
      }
    } else {
      const { error } = await supabase.from('members').insert(payload);
      if (error) {
        failed++;
        errors.push(`${name}: ${error.message}`);
      } else {
        success++;
      }
    }
  }

  revalidatePath('/dashboard/members');
  return { success, failed, errors: errors.slice(0, 20) };
}
