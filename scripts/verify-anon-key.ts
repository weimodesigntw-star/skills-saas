/**
 * 驗證 Anon Key 是否正確
 * 檢查常見錯誤：service_role key、截斷的 key、錯誤專案的 key
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 驗證 Anon Key\n');
console.log('='.repeat(60));

if (!anonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 未設置！');
  process.exit(1);
}

console.log(`\n📋 當前 Anon Key:`);
console.log(`   完整長度: ${anonKey.length} 字元`);
console.log(`   開頭 10 字元: ${anonKey.substring(0, 10)}...`);
console.log(`   結尾 10 字元: ...${anonKey.substring(anonKey.length - 10)}`);

console.log('\n' + '='.repeat(60));
console.log('\n✅ 檢查常見錯誤:\n');

// 檢查 1: 是否為 service_role key
if (anonKey.includes('service_role') || anonKey.includes('eyJ') && anonKey.length > 200) {
  console.log('❌ 錯誤：這可能是 service_role key！');
  console.log('   service_role key 很長（通常 > 200 字元）');
  console.log('   Middleware 應該使用 anon public key，不是 service_role key');
  console.log('   ⚠️  請到 Supabase Dashboard > Settings > API 複製 anon public key');
} else {
  console.log('✅ 不是 service_role key（正確）');
}

// 檢查 2: 是否為 Publishable Key 格式
if (anonKey.startsWith('sb_publishable_')) {
  console.log('✅ 格式：Publishable Key (新格式)');
  console.log(`   長度: ${anonKey.length} 字元`);
  
  // Publishable Key 通常約 46-50 字元
  if (anonKey.length < 40) {
    console.log('⚠️  警告：Key 長度可能太短，可能被截斷了！');
    console.log('   請確認複製了完整的 key');
  } else if (anonKey.length > 60) {
    console.log('⚠️  警告：Key 長度可能太長，可能複製了其他內容！');
  } else {
    console.log('✅ Key 長度正常');
  }
} else if (anonKey.startsWith('eyJ')) {
  console.log('✅ 格式：JWT Token (舊格式)');
  console.log(`   長度: ${anonKey.length} 字元`);
  
  // JWT Token 通常很長（> 200 字元）
  if (anonKey.length < 200) {
    console.log('⚠️  警告：JWT Token 長度可能太短，可能被截斷了！');
    console.log('   請確認複製了完整的 key');
  } else {
    console.log('✅ Key 長度正常');
  }
} else {
  console.log('⚠️  未知格式：Key 格式不符合預期');
  console.log('   應該是 sb_publishable_... 或 eyJ...');
}

// 檢查 3: 與 Supabase Dashboard 截圖比對
const dashboardKey = 'sb_publishable_mcSK_VJVTFczNBnWHrJIVA_jM4AcaoH';
const dashboardKeyStart = dashboardKey.substring(0, 20);
const dashboardKeyEnd = dashboardKey.substring(dashboardKey.length - 10);

console.log('\n📸 與 Supabase Dashboard 截圖比對:');
console.log(`   Dashboard Key 開頭: ${dashboardKeyStart}...`);
console.log(`   當前 Key 開頭: ${anonKey.substring(0, 20)}...`);

if (anonKey.substring(0, 20) === dashboardKeyStart) {
  console.log('✅ 開頭 20 字元匹配！');
} else {
  console.log('❌ 開頭不匹配！');
  console.log('   請確認從 Supabase Dashboard 複製的是正確的 key');
}

console.log(`\n   Dashboard Key 結尾: ...${dashboardKeyEnd}`);
console.log(`   當前 Key 結尾: ...${anonKey.substring(anonKey.length - 10)}`);

if (anonKey.substring(anonKey.length - 10) === dashboardKeyEnd) {
  console.log('✅ 結尾 10 字元匹配！');
} else {
  console.log('❌ 結尾不匹配！');
  console.log('   可能複製時少複製了最後幾個字元');
}

// 完整比對
if (anonKey === dashboardKey) {
  console.log('\n🎉 完美！Key 完全匹配 Supabase Dashboard！');
} else {
  console.log('\n⚠️  Key 不完全匹配');
  console.log('   請確認從 Supabase Dashboard > Settings > API 複製的是 anon public key');
}

console.log('\n' + '='.repeat(60));
