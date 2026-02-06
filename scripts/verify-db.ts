/**
 * 驗證數據庫設置腳本
 * 
 * 檢查 categories 表是否存在
 * 
 * 執行方式：
 * npx tsx scripts/verify-db.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 載入 .env.local 文件
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 錯誤：環境變數未設置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyDatabase() {
  console.log('🔍 驗證數據庫設置...\n');

  try {
    // 嘗試查詢 categories 表
    const { data, error } = await supabase
      .from('categories')
      .select('id')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST205') {
        console.error('❌ 錯誤：找不到 categories 表');
        console.error('');
        console.error('解決方案：');
        console.error('1. 打開 Supabase Dashboard > SQL Editor');
        console.error('2. 執行文件：supabase/migrations/002_complete_setup.sql');
        console.error('3. 確認執行成功（顯示 Success）');
        console.error('4. 在 Table Editor 中確認 categories 表存在');
      } else {
        console.error('❌ 錯誤：', error);
      }
      process.exit(1);
    }

    console.log('✅ categories 表存在！');
    console.log(`   當前有 ${data?.length || 0} 筆數據\n`);

    // 測試插入權限
    console.log('🔍 測試插入權限...');
    const { error: insertError } = await supabase
      .from('categories')
      .insert({
        name: '_test_' + Date.now(),
        description: '測試分類（將被刪除）',
        parent_id: null,
        sort_order: 9999,
      })
      .select();

    if (insertError) {
      console.error('❌ 插入測試失敗：', insertError.message);
      console.error('   可能是 RLS 策略限制');
    } else {
      console.log('✅ 插入權限正常');
      
      // 清理測試數據
      await supabase
        .from('categories')
        .delete()
        .like('name', '_test_%');
    }

    console.log('\n✅ 數據庫設置驗證完成！');
    console.log('   現在可以執行種子數據腳本：npx tsx scripts/seed-categories.ts\n');
  } catch (error) {
    console.error('❌ 驗證失敗：', error);
    if (error instanceof Error) {
      console.error('   錯誤訊息：', error.message);
    }
    process.exit(1);
  }
}

verifyDatabase();
