/**
 * 檢查分類數據
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 環境變數未設置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 檢查分類數據...\n');
  
  // 查詢所有分類
  const { data: allCategories, error: allError } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  
  if (allError) {
    console.error('❌ 查詢失敗:', allError.message);
    process.exit(1);
  }
  
  console.log(`總共找到 ${allCategories?.length || 0} 筆分類\n`);
  
  if (allCategories && allCategories.length > 0) {
    console.log('分類列表:');
    allCategories.forEach(cat => {
      console.log(`  - ${cat.name} (ID: ${cat.id.substring(0, 8)}..., user_id: ${cat.user_id || 'null'}, parent_id: ${cat.parent_id ? cat.parent_id.substring(0, 8) + '...' : 'null'})`);
    });
    
    // 檢查 user_id 分布
    const withUserId = allCategories.filter(c => c.user_id !== null);
    const withoutUserId = allCategories.filter(c => c.user_id === null);
    
    console.log(`\n統計:`);
    console.log(`  - user_id 為 null: ${withoutUserId.length} 筆`);
    console.log(`  - user_id 不為 null: ${withUserId.length} 筆`);
    
    if (withoutUserId.length > 0 && withUserId.length === 0) {
      console.log(`\n⚠️  所有分類的 user_id 都是 null`);
      console.log(`   如果用戶已登入，getCategories() 會查詢 user_id = user.id 的分類`);
      console.log(`   所以查不到這些分類！`);
      console.log(`\n💡 解決方案：`);
      console.log(`   修改 getCategories() 邏輯，讓已登入用戶也能看到 user_id 為 null 的分類`);
    }
  } else {
    console.log('❌ 沒有找到任何分類數據');
  }
})();
