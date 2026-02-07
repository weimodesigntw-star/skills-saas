/**
 * 測試用戶配額功能
 * 
 * 使用方法：
 * npx tsx scripts/test-quota.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 載入環境變數
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 請設定 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuota() {
  console.log('🧪 開始測試用戶配額功能...\n');

  // 1. 檢查 profiles 表結構
  console.log('1️⃣ 檢查 profiles 表結構...');
  const { data: columns, error: columnsError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (columnsError) {
    console.error('❌ 無法查詢 profiles 表:', columnsError.message);
    console.log('\n💡 提示：請確認已執行 SQL Migration (003_add_user_quota.sql)');
    return;
  }

  console.log('✅ profiles 表存在\n');

  // 2. 檢查欄位是否存在（通過查詢來驗證）
  console.log('2️⃣ 檢查新增欄位...');
  const { data: sampleProfile, error: sampleError } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count, last_reset_date, stripe_customer_id, stripe_subscription_id')
    .limit(1);

  if (sampleError) {
    console.error('❌ 查詢欄位時發生錯誤:', sampleError.message);
    if (sampleError.message.includes('column') && sampleError.message.includes('does not exist')) {
      console.log('\n💡 提示：請確認已執行 SQL Migration，所有欄位都已添加');
    }
    return;
  }

  console.log('✅ 所有欄位都存在');
  if (sampleProfile && sampleProfile.length > 0) {
    console.log('📊 範例資料:', sampleProfile[0]);
  }
  console.log('');

  // 3. 檢查 RLS 策略
  console.log('3️⃣ 檢查 RLS 策略...');
  console.log('💡 RLS 策略需要在 Supabase Dashboard 中手動檢查');
  console.log('   請確認 "Users can view own profile" 和 "Users can update own profile" 策略已啟用\n');

  // 4. 檢查觸發器
  console.log('4️⃣ 檢查觸發器...');
  console.log('💡 觸發器需要在 Supabase Dashboard 中手動檢查');
  console.log('   請確認 "update_profiles_updated_at" 觸發器已創建\n');

  console.log('✅ 基本檢查完成！');
  console.log('\n📝 下一步：');
  console.log('1. 啟動開發伺服器：npm run dev');
  console.log('2. 登入一個用戶帳號');
  console.log('3. 嘗試生成 AI 分類');
  console.log('4. 檢查終端機日誌，應該看到配額檢查的訊息');
  console.log('\n🧪 測試配額限制：');
  console.log('在 Supabase SQL Editor 執行：');
  console.log(`
UPDATE profiles 
SET ai_usage_count = 3
WHERE email = 'your-email@example.com';
`);
  console.log('然後嘗試生成 AI 分類，應該返回 403 錯誤');
}

testQuota().catch(console.error);
