/**
 * 認證診斷腳本
 * 
 * 檢查認證相關的配置和狀態
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 載入環境變數
config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 認證診斷檢查\n');

// 檢查環境變數
console.log('1. 環境變數檢查:');
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✅ 已設置' : '❌ 未設置'}`);
console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseKey ? '✅ 已設置' : '❌ 未設置'}`);

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ 環境變數未完整設置，請檢查 .env.local');
  process.exit(1);
}

// 檢查 Supabase 連接
console.log('\n2. Supabase 連接測試:');
const supabase = createClient(supabaseUrl, supabaseKey);

supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.log(`   ❌ 連接錯誤: ${error.message}`);
  } else {
    console.log(`   ✅ 連接成功`);
    console.log(`   Session: ${data.session ? '已登入' : '未登入'}`);
  }
}).catch((err) => {
  console.error(`   ❌ 連接失敗:`, err);
});

console.log('\n3. Middleware 檢查:');
console.log('   請檢查 middleware.ts 文件是否存在於專案根目錄');
console.log('   文件路徑: ./middleware.ts');

console.log('\n4. 建議檢查項目:');
console.log('   - 終端機中是否有 [Middleware] 開頭的日誌');
console.log('   - Network 標籤中 Request Headers 是否有 Supabase cookies');
console.log('   - Application 標籤中 Cookies 是否有 sb- 開頭的 cookies');

console.log('\n✅ 診斷完成');
