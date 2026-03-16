'use server';

import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/** ERP 產品資料列（Excel 標題對應） */
export type ImportProductRow = {
  產品代碼?: string;
  產品名稱: string;
  規格?: string;
  顏色?: string;
  標準單位?: string;
  產品類別名稱?: string;
  零售價?: number | string;
  批發價?: number | string;
  採購單價?: number | string;
  停用?: string | number;
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const name = (row.產品名稱 ?? '').toString().trim();
    if (!name) {
      failed++;
      errors.push('跳過：缺少產品名稱');
      continue;
    }

    const productCode = row.產品代碼 != null ? String(row.產品代碼).trim() : '';
    const categoryName = row.產品類別名稱 != null ? String(row.產品類別名稱).trim() : '';
    let categoryId: string | null = null;

    if (categoryName) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', categoryName)
        .maybeSingle();

      if (cat?.id) {
        categoryId = cat.id;
      } else {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({ user_id: user.id, name: categoryName })
          .select('id')
          .single();
        categoryId = newCat?.id ?? null;
      }
    }

    const spec = (row.規格 ?? '').toString().trim();
    const color = (row.顏色 ?? '').toString().trim();
    const description = [spec, color].filter(Boolean).join(' ') || null;
    const disable = row.停用 != null ? String(row.停用) : '';
    const isActive = disable !== '1';

    const payload = {
      user_id: user.id,
      name,
      product_code: productCode || null,
      description,
      unit_name: (row.標準單位 ?? '').toString().trim() || null,
      price: Number(row.零售價) || 0,
      whole_sell_price: Number(row.批發價) || 0,
      purchase_price: Number(row.採購單價) || 0,
      category_id: categoryId,
      is_active: isActive,
      stock: 0,
      low_stock_threshold: 5,
    };

    if (productCode) {
      const { data: existing } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_code', productCode)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from('products').update(payload).eq('id', existing.id);
        if (error) {
          failed++;
          errors.push(`${name}: ${error.message}`);
        } else {
          success++;
        }
      } else {
        const { error } = await supabase.from('products').insert(payload);
        if (error) {
          failed++;
          errors.push(`${name}: ${error.message}`);
        } else {
          success++;
        }
      }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) {
        failed++;
        errors.push(`${name}: ${error.message}`);
      } else {
        success++;
      }
    }
  }

  revalidatePath('/dashboard/products');
  return { success, failed, errors: errors.slice(0, 20) };
}

/** 批次匯入會員 */
export async function importMembers(rows: ImportMemberRow[]): Promise<ImportResult | { error: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

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
      user_id: user.id,
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
        .eq('user_id', user.id)
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
