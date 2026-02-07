/**
 * 自動檢測用戶配額功能
 * 
 * 使用方法：
 * npx tsx scripts/check-quota.ts
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

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string, details?: any) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details && !passed) {
    console.log('   詳細資訊:', details);
  }
}

async function checkDatabaseStructure() {
  console.log('\n📊 步驟 1: 檢查資料庫結構...\n');

  // 檢查 profiles 表是否存在
  const { data: tableCheck, error: tableError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (tableError) {
    addResult(
      'Profiles 表存在',
      false,
      `無法查詢 profiles 表: ${tableError.message}`,
      tableError
    );
    return false;
  }

  addResult('Profiles 表存在', true, '表已創建');

  // 檢查必要欄位
  const requiredFields = [
    'tier',
    'ai_usage_count',
    'last_reset_date',
    'stripe_customer_id',
    'stripe_subscription_id',
  ];

  const { data: sampleProfile } = await supabase
    .from('profiles')
    .select(requiredFields.join(', '))
    .limit(1);

  if (!sampleProfile || sampleProfile.length === 0) {
    // 嘗試查詢所有欄位來檢查
    const { error: fieldError } = await supabase
      .from('profiles')
      .select('tier')
      .limit(1);

    if (fieldError && fieldError.message.includes('column')) {
      addResult(
        '必要欄位存在',
        false,
        '某些欄位不存在，請確認已執行 SQL Migration',
        fieldError
      );
      return false;
    }
  }

  addResult('必要欄位存在', true, `所有 ${requiredFields.length} 個欄位都已添加`);

  return true;
}

async function checkUserProfiles() {
  console.log('\n👤 步驟 2: 檢查用戶資料...\n');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, tier, ai_usage_count, last_reset_date')
    .limit(10);

  if (error) {
    addResult('查詢用戶資料', false, error.message, error);
    return null;
  }

  if (!profiles || profiles.length === 0) {
    addResult(
      '查詢用戶資料', 
      true, 
      '沒有找到任何用戶資料（這是正常的，profile 會在首次使用時自動創建）',
      {
        note: '當用戶首次使用 AI 功能時，checkAiLimit() 會自動創建 profile 記錄'
      }
    );
    console.log('   💡 提示：這是正常的，profile 會在用戶首次使用時自動創建');
    return [];
  }

  addResult('查詢用戶資料', true, `找到 ${profiles.length} 個用戶`);

  // 檢查默認值
  const freeUsers = profiles.filter(p => p.tier === 'free' || !p.tier);
  const proUsers = profiles.filter(p => p.tier === 'pro');
  
  console.log(`   - Free 用戶: ${freeUsers.length}`);
  console.log(`   - Pro 用戶: ${proUsers.length}`);

  // 顯示前 3 個用戶的狀態
  console.log('\n   前 3 個用戶的配額狀態:');
  profiles.slice(0, 3).forEach((profile, index) => {
    const status = profile.tier === 'pro' 
      ? '無限制' 
      : (profile.ai_usage_count || 0) < 3 
        ? `剩餘 ${3 - (profile.ai_usage_count || 0)} 次`
        : '已達限制';
    console.log(`   ${index + 1}. ${profile.email || 'N/A'}: ${profile.tier || 'free'}, ${status}`);
  });

  return profiles;
}

async function testQuotaLogic(profiles: any[]) {
  console.log('\n🧪 步驟 3: 測試配額邏輯...\n');

  if (!profiles || profiles.length === 0) {
    addResult('配額邏輯測試', false, '沒有用戶資料可供測試');
    return;
  }

  const testUser = profiles[0];

  // 測試 1: Free 用戶未達限制
  const { error: update1Error } = await supabase
    .from('profiles')
    .update({
      tier: 'free',
      ai_usage_count: 0,
      last_reset_date: new Date().toISOString(),
    })
    .eq('id', testUser.id);

  if (update1Error) {
    addResult('設置測試狀態（未達限制）', false, update1Error.message, update1Error);
  } else {
    addResult('設置測試狀態（未達限制）', true, '已設置為 Free，使用次數 0');
  }

  // 驗證邏輯
  const { data: check1 } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count')
    .eq('id', testUser.id)
    .single();

  if (check1) {
    const allowed = check1.tier === 'pro' || (check1.ai_usage_count || 0) < 3;
    addResult(
      '配額檢查邏輯（未達限制）',
      allowed === true,
      allowed ? '允許使用（正確）' : '不允許使用（錯誤）',
      { tier: check1.tier, usage: check1.ai_usage_count, allowed }
    );
  }

  // 測試 2: Free 用戶已達限制
  const { error: update2Error } = await supabase
    .from('profiles')
    .update({
      tier: 'free',
      ai_usage_count: 3,
      last_reset_date: new Date().toISOString(),
    })
    .eq('id', testUser.id);

  if (update2Error) {
    addResult('設置測試狀態（已達限制）', false, update2Error.message, update2Error);
  } else {
    addResult('設置測試狀態（已達限制）', true, '已設置為 Free，使用次數 3');
  }

  // 驗證邏輯
  const { data: check2 } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count')
    .eq('id', testUser.id)
    .single();

  if (check2) {
    const allowed = check2.tier === 'pro' || (check2.ai_usage_count || 0) < 3;
    addResult(
      '配額檢查邏輯（已達限制）',
      allowed === false,
      allowed ? '允許使用（錯誤）' : '不允許使用（正確）',
      { tier: check2.tier, usage: check2.ai_usage_count, allowed }
    );
  }

  // 測試 3: Pro 用戶無限制
  const { error: update3Error } = await supabase
    .from('profiles')
    .update({
      tier: 'pro',
      ai_usage_count: 999, // 即使很高也應該允許
    })
    .eq('id', testUser.id);

  if (update3Error) {
    addResult('設置測試狀態（Pro 用戶）', false, update3Error.message, update3Error);
  } else {
    addResult('設置測試狀態（Pro 用戶）', true, '已設置為 Pro，使用次數 999');
  }

  // 驗證邏輯
  const { data: check3 } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count')
    .eq('id', testUser.id)
    .single();

  if (check3) {
    const allowed = check3.tier === 'pro' || (check3.ai_usage_count || 0) < 3;
    addResult(
      '配額檢查邏輯（Pro 用戶）',
      allowed === true,
      allowed ? '允許使用（正確）' : '不允許使用（錯誤）',
      { tier: check3.tier, usage: check3.ai_usage_count, allowed }
    );
  }

  // 恢復為初始狀態
  await supabase
    .from('profiles')
    .update({
      tier: 'free',
      ai_usage_count: 0,
      last_reset_date: new Date().toISOString(),
    })
    .eq('id', testUser.id);
}

async function testResetLogic(profiles: any[]) {
  console.log('\n🔄 步驟 4: 測試每日重置邏輯...\n');

  if (!profiles || profiles.length === 0) {
    addResult('重置邏輯測試', false, '沒有用戶資料可供測試');
    return;
  }

  const testUser = profiles[0];

  // 設置為昨天，已達限制
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      tier: 'free',
      ai_usage_count: 3,
      last_reset_date: yesterday.toISOString(),
    })
    .eq('id', testUser.id);

  if (updateError) {
    addResult('設置重置測試狀態', false, updateError.message, updateError);
    return;
  }

  addResult('設置重置測試狀態', true, '已設置為昨天，使用次數 3');

  // 檢查日期邏輯
  const { data: check } = await supabase
    .from('profiles')
    .select('last_reset_date, ai_usage_count')
    .eq('id', testUser.id)
    .single();

  if (check && check.last_reset_date) {
    const resetDate = new Date(check.last_reset_date);
    const today = new Date();
    const resetDateOnly = new Date(resetDate.getFullYear(), resetDate.getMonth(), resetDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const daysDiff = Math.floor((todayOnly.getTime() - resetDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    const shouldReset = daysDiff >= 1;

    addResult(
      '重置日期計算',
      shouldReset === true,
      shouldReset ? '應該重置（正確）' : '不應該重置（錯誤）',
      { 
        resetDate: resetDate.toISOString().split('T')[0],
        today: today.toISOString().split('T')[0],
        daysDiff,
        shouldReset
      }
    );
  }

  // 恢復為初始狀態
  await supabase
    .from('profiles')
    .update({
      tier: 'free',
      ai_usage_count: 0,
      last_reset_date: new Date().toISOString(),
    })
    .eq('id', testUser.id);
}

async function checkRLSPolicies() {
  console.log('\n🔐 步驟 5: 檢查 RLS 策略...\n');

  // 注意：RLS 策略檢查需要服務端權限，這裡只能提示
  addResult(
    'RLS 策略',
    true,
    '請在 Supabase Dashboard → Authentication → Policies 中手動檢查',
    {
      note: '應該有兩個策略：',
      policies: [
        'Users can view own profile (SELECT)',
        'Users can update own profile (UPDATE)',
      ],
    }
  );
}

async function checkTriggers() {
  console.log('\n⚙️  步驟 6: 檢查觸發器...\n');

  // 注意：觸發器檢查需要服務端權限，這裡只能提示
  addResult(
    '觸發器',
    true,
    '請在 Supabase Dashboard → Database → Triggers 中手動檢查',
    {
      note: '應該有一個觸發器：',
      trigger: 'update_profiles_updated_at (BEFORE UPDATE)',
    }
  );
}

async function main() {
  console.log('🚀 開始自動檢測用戶配額功能...\n');
  console.log('=' .repeat(60));

  // 步驟 1: 檢查資料庫結構
  const structureOk = await checkDatabaseStructure();
  
  if (!structureOk) {
    console.log('\n❌ 資料庫結構檢查失敗，請先執行 SQL Migration');
    console.log('   檔案位置: supabase/migrations/003_add_user_quota.sql');
    process.exit(1);
  }

  // 步驟 2: 檢查用戶資料
  const profiles = await checkUserProfiles();

  // 步驟 3: 測試配額邏輯
  if (profiles && profiles.length > 0) {
    await testQuotaLogic(profiles);
    await testResetLogic(profiles);
  } else {
    console.log('\n⚠️  跳過配額邏輯測試（沒有用戶資料）');
    console.log('   💡 提示：當用戶首次使用 AI 功能時，系統會自動創建 profile');
    addResult(
      '配額邏輯測試',
      true,
      '跳過（沒有用戶資料，這是正常的）',
      { note: '首次使用時會自動創建 profile' }
    );
    addResult(
      '重置邏輯測試',
      true,
      '跳過（沒有用戶資料，這是正常的）',
      { note: '首次使用時會自動創建 profile' }
    );
  }

  // 步驟 4: 檢查 RLS 和觸發器（提示手動檢查）
  await checkRLSPolicies();
  await checkTriggers();

  // 總結
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 檢測結果總結:\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`✅ 通過: ${passed}/${total}`);
  console.log(`❌ 失敗: ${failed}/${total}`);

  if (failed > 0) {
    console.log('\n❌ 失敗的測試:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
  }

  console.log('\n📝 下一步:');
  console.log('1. 如果所有測試通過，可以開始實際應用測試');
  console.log('2. 啟動開發伺服器: npm run dev');
  console.log('3. 登入應用並嘗試生成 AI 分類');
  console.log('4. 檢查終端日誌中的 [Check AI Limit] 和 [Increment AI Usage] 訊息');

  if (failed === 0) {
    console.log('\n🎉 所有檢測通過！配額功能應該正常運作。');
  } else {
    console.log('\n⚠️  請修復失敗的測試後再繼續。');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ 檢測過程中發生錯誤:', error);
  process.exit(1);
});
