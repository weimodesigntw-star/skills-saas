/**
 * 驗證環境變數配置
 * 檢查 .env.local 中的 Supabase 配置是否正確
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 載入 .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 環境變數驗證\n');
console.log('='.repeat(50));

// 檢查 URL
console.log('\n1️⃣ 檢查 NEXT_PUBLIC_SUPABASE_URL:');
if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 未設置！');
  process.exit(1);
}

console.log(`✅ URL: ${supabaseUrl}`);

// 檢查 URL 格式
if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.warn('⚠️  URL 格式可能不正確，應該是 https://xxxxx.supabase.co');
}

// 提取 Project ID
const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (urlMatch) {
  const projectId = urlMatch[1];
  console.log(`✅ Project ID: ${projectId}`);
  console.log(`   Cookie 應該以 sb-${projectId.substring(0, 8)}... 開頭`);
} else {
  console.warn('⚠️  無法從 URL 提取 Project ID');
}

// 檢查 ANON KEY
console.log('\n2️⃣ 檢查 NEXT_PUBLIC_SUPABASE_ANON_KEY:');
if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 未設置！');
  process.exit(1);
}

console.log(`✅ Key 長度: ${supabaseAnonKey.length} 字元`);

// 檢查 Key 格式
// Supabase anon key 通常是 JWT token (eyJ...) 或新的 publishable key (sb_publishable_...)
const isJWT = supabaseAnonKey.startsWith('eyJ');
const isPublishable = supabaseAnonKey.startsWith('sb_publishable_');

if (isJWT) {
  console.log('✅ Key 格式: JWT Token (舊格式)');
} else if (isPublishable) {
  console.log('✅ Key 格式: Publishable Key (新格式)');
} else {
  console.warn('⚠️  Key 格式可能不正確！');
  console.warn('   應該是 eyJ... (JWT) 或 sb_publishable_... (Publishable)');
}

// 測試連接
console.log('\n3️⃣ 測試 Supabase 連接:');
(async () => {
  try {
    // 方法 1: 測試 REST API 端點
    const restResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    
    if (restResponse.ok) {
      console.log('✅ Supabase REST API 連接成功！');
    } else {
      console.warn(`⚠️  REST API 測試失敗: ${restResponse.status} ${restResponse.statusText}`);
      console.log('   這不一定代表配置錯誤，繼續測試 Auth API...');
    }

    // 方法 2: 測試 Auth API 端點（更重要的測試）
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        'apikey': supabaseAnonKey,
      },
    });
    
    if (authResponse.ok) {
      const healthData = await authResponse.json();
      console.log('✅ Supabase Auth API 連接成功！');
      console.log(`   Auth 服務狀態: ${healthData.status || 'healthy'}`);
    } else {
      console.error(`❌ Auth API 測試失敗: ${authResponse.status} ${authResponse.statusText}`);
      console.error('   請檢查 URL 和 ANON KEY 是否正確');
      console.error('   確認從 Supabase Dashboard > Settings > API 複製的是 anon public key');
    }
  } catch (error) {
    console.error('❌ 連接錯誤:', error instanceof Error ? error.message : error);
  }
})();

console.log('\n' + '='.repeat(50));
console.log('\n📝 下一步：');
console.log('1. 如果看到錯誤，請到 Supabase Dashboard > Settings > API');
console.log('2. 複製正確的 Project URL 和 anon public key');
console.log('3. 更新 .env.local 文件');
console.log('4. 重啟開發伺服器 (Ctrl+C 然後 npm run dev)');
console.log('5. 清除瀏覽器 Cookies (F12 > Application > Clear Site Data)');
