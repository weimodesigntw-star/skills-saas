/**
 * 重置並重新插入分類種子數據
 * 
 * 執行方式：
 * npx tsx scripts/reset-and-seed.ts
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

async function resetAndSeed() {
  console.log('🔄 開始重置並重新插入種子數據...\n');

  try {
    // 1. 刪除所有現有分類
    console.log('1️⃣ 刪除所有現有分類...');
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 刪除所有（使用一個不存在的 ID 來刪除所有）

    if (deleteError) {
      // 如果刪除失敗，可能是因為外鍵約束，嘗試級聯刪除
      console.log('   嘗試級聯刪除...');
      // 先刪除子分類
      const { data: allCategories } = await supabase
        .from('categories')
        .select('id, parent_id');
      
      if (allCategories) {
        const childIds = allCategories
          .filter(cat => cat.parent_id !== null)
          .map(cat => cat.id);
        
        if (childIds.length > 0) {
          await supabase
            .from('categories')
            .delete()
            .in('id', childIds);
        }
        
        // 再刪除根分類
        const rootIds = allCategories
          .filter(cat => cat.parent_id === null)
          .map(cat => cat.id);
        
        if (rootIds.length > 0) {
          await supabase
            .from('categories')
            .delete()
            .in('id', rootIds);
        }
      }
    }

    console.log('✅ 已清空分類數據\n');

    // 2. 插入根分類
    console.log('2️⃣ 插入根分類...');
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

    // 3. 插入子分類
    console.log('\n3️⃣ 插入子分類...');
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
        console.log('✅ 已插入「服飾」子分類：');
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
        console.log('✅ 已插入「3C」子分類：');
        electronicsChildren.forEach(cat => {
          console.log(`   - ${cat.name}`);
        });
      }
    }

    console.log('\n🎉 種子數據重置完成！');
    console.log('   現在可以訪問 http://localhost:3000/dashboard/categories 查看結果\n');
  } catch (error) {
    console.error('❌ 操作失敗：', error);
    if (error instanceof Error) {
      console.error('   錯誤訊息：', error.message);
    }
    process.exit(1);
  }
}

// 執行
resetAndSeed();
