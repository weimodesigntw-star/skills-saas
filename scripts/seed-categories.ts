/**
 * 分類種子數據腳本
 * 
 * 快速插入測試分類數據，方便測試功能
 * 
 * 執行方式：
 * npx tsx scripts/seed-categories.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 載入 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') });

// 從環境變數讀取 Supabase 配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 錯誤：請先設置環境變數');
  console.error('   在 .env.local 中設置：');
  console.error('   NEXT_PUBLIC_SUPABASE_URL=...');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 測試分類數據
 */
const testCategories = [
  {
    name: '服飾',
    description: '服裝相關分類',
    parent_id: null,
    sort_order: 0,
  },
  {
    name: '3C',
    description: '電子產品',
    parent_id: null,
    sort_order: 1,
  },
  {
    name: '傢俱',
    description: '傢俱相關',
    parent_id: null,
    sort_order: 2,
  },
];

async function seedCategories() {
  console.log('🌱 開始插入種子數據...\n');

  try {
    // 先檢查是否已有數據
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log('⚠️  數據庫中已有分類數據');
      console.log('   如果要重新插入，請先清空 categories 表\n');
      return;
    }

    // 插入根分類
    const { data: rootCategories, error: rootError } = await supabase
      .from('categories')
      .insert(testCategories)
      .select();

    if (rootError) {
      throw rootError;
    }

    console.log('✅ 已插入根分類：');
    rootCategories?.forEach(cat => {
      console.log(`   - ${cat.name}`);
    });

    // 插入子分類
    const clothingId = rootCategories?.find(c => c.name === '服飾')?.id;
    const electronicsId = rootCategories?.find(c => c.name === '3C')?.id;

    if (clothingId) {
      const { data: clothingChildren, error: clothingError } = await supabase
        .from('categories')
        .insert([
          {
            name: '男裝',
            description: '男性服飾',
            parent_id: clothingId,
            sort_order: 0,
          },
          {
            name: '女裝',
            description: '女性服飾',
            parent_id: clothingId,
            sort_order: 1,
          },
        ])
        .select();

      if (!clothingError && clothingChildren) {
        console.log('\n✅ 已插入「服飾」子分類：');
        clothingChildren.forEach(cat => {
          console.log(`   - ${cat.name}`);
        });
      }
    }

    if (electronicsId) {
      const { data: electronicsChildren, error: electronicsError } = await supabase
        .from('categories')
        .insert([
          {
            name: '手機',
            description: '智慧型手機',
            parent_id: electronicsId,
            sort_order: 0,
          },
          {
            name: '筆記本電腦',
            description: '筆記本電腦',
            parent_id: electronicsId,
            sort_order: 1,
          },
        ])
        .select();

      if (!electronicsError && electronicsChildren) {
        console.log('\n✅ 已插入「3C」子分類：');
        electronicsChildren.forEach(cat => {
          console.log(`   - ${cat.name}`);
        });
      }
    }

    console.log('\n🎉 種子數據插入完成！');
    console.log('   現在可以訪問 http://localhost:3000/dashboard/categories 查看結果\n');
  } catch (error) {
    console.error('❌ 插入失敗：', error);
    if (error instanceof Error) {
      console.error('   錯誤訊息：', error.message);
    }
    process.exit(1);
  }
}

// 執行
seedCategories();
