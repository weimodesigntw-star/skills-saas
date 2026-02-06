/**
 * 比對 .env.local 配置與 Supabase Dashboard 截圖
 * 確認配置是否完全匹配
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 載入 .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 比對配置與 Supabase Dashboard\n');
console.log('='.repeat(60));

// 從截圖中看到的配置
const dashboardUrl = 'https://ucwcavjnqalnxnisiuha.supabase.co';
const dashboardKey = 'sb_publishable_mcSK_VJVTFczNBnWHrJIVA_jM4AcaoH';
const dashboardProjectId = 'ucwcavjnqalnxnisiuha';

console.log('\n📸 Supabase Dashboard 截圖中的配置:');
console.log(`   Project URL: ${dashboardUrl}`);
console.log(`   Project ID: ${dashboardProjectId}`);
console.log(`   Publishable Key: ${dashboardKey.substring(0, 30)}...`);

console.log('\n📄 .env.local 文件中的配置:');
console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${envUrl || '未設置'}`);
console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY: ${envKey ? envKey.substring(0, 30) + '...' : '未設置'}`);

console.log('\n' + '='.repeat(60));
console.log('\n✅ 比對結果:\n');

// 比對 URL
let urlMatch = false;
if (envUrl === dashboardUrl) {
  console.log('✅ Project URL: 完全匹配！');
  urlMatch = true;
} else {
  console.log('❌ Project URL: 不匹配！');
  console.log(`   期望: ${dashboardUrl}`);
  console.log(`   實際: ${envUrl || '未設置'}`);
}

// 比對 Project ID
const envProjectId = envUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
let projectIdMatch = false;
if (envProjectId === dashboardProjectId) {
  console.log('✅ Project ID: 完全匹配！');
  projectIdMatch = true;
} else {
  console.log('❌ Project ID: 不匹配！');
  console.log(`   期望: ${dashboardProjectId}`);
  console.log(`   實際: ${envProjectId || '無法提取'}`);
}

// 比對 Key
let keyMatch = false;
if (envKey === dashboardKey) {
  console.log('✅ Publishable Key: 完全匹配！');
  keyMatch = true;
} else {
  console.log('❌ Publishable Key: 不匹配！');
  console.log(`   期望: ${dashboardKey.substring(0, 30)}...`);
  console.log(`   實際: ${envKey ? envKey.substring(0, 30) + '...' : '未設置'}`);
  
  // 檢查是否只是格式不同（新格式 vs 舊格式）
  if (envKey && envKey.startsWith('sb_publishable_') && dashboardKey.startsWith('sb_publishable_')) {
    console.log('   ⚠️  兩個都是 Publishable Key 格式，但值不同');
    console.log('   請確認從 Supabase Dashboard 複製的是完整的 key');
  }
}

console.log('\n' + '='.repeat(60));

if (urlMatch && projectIdMatch && keyMatch) {
  console.log('\n🎉 完美！所有配置都與 Supabase Dashboard 匹配！');
  console.log('✅ Middleware 可以正常使用此配置進行認證');
  console.log('✅ 可以開始測試登入功能了！');
} else {
  console.log('\n⚠️  發現配置不匹配！');
  console.log('\n📝 修復步驟:');
  console.log('1. 打開 Supabase Dashboard > Settings > API Keys');
  console.log('2. 複製正確的 Project URL 和 Publishable Key');
  console.log('3. 更新 .env.local 文件');
  console.log('4. 重啟開發伺服器 (Ctrl+C 然後 npm run dev)');
  console.log('5. 清除瀏覽器 Cookies (F12 > Application > Clear Site Data)');
}
