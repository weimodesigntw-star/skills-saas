/**
 * 驗證 Middleware 配置
 * 確認 Middleware 使用的驗證密鑰與 Supabase Dashboard 是否匹配
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';

// 載入 .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Middleware 配置驗證\n');
console.log('='.repeat(60));

// 檢查 Middleware 會讀取的環境變數
console.log('\n1️⃣ 檢查 Middleware 會讀取的環境變數:');
console.log('   (Middleware 使用 process.env.NEXT_PUBLIC_SUPABASE_URL 和 process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)');

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 未設置！');
  console.error('   Middleware 無法讀取到 Supabase URL');
  process.exit(1);
}

if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY 未設置！');
  console.error('   Middleware 無法讀取到 Supabase ANON KEY');
  process.exit(1);
}

console.log(`\n✅ NEXT_PUBLIC_SUPABASE_URL:`);
console.log(`   ${supabaseUrl}`);

// 提取 Project ID
const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (urlMatch) {
  const projectId = urlMatch[1];
  console.log(`\n✅ Project ID: ${projectId}`);
  console.log(`   Cookie 應該以 sb-${projectId.substring(0, 8)}... 開頭`);
} else {
  console.warn('⚠️  無法從 URL 提取 Project ID');
}

console.log(`\n✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:`);
console.log(`   長度: ${supabaseAnonKey.length} 字元`);
console.log(`   格式: ${supabaseAnonKey.startsWith('sb_publishable_') ? 'Publishable Key (新格式)' : supabaseAnonKey.startsWith('eyJ') ? 'JWT Token (舊格式)' : '未知格式'}`);
console.log(`   前 20 字元: ${supabaseAnonKey.substring(0, 20)}...`);

// 測試 Middleware 會使用的 Supabase Client 配置
console.log('\n2️⃣ 測試 Middleware 會使用的 Supabase 配置:');
console.log('   (模擬 Middleware 的 createServerClient 配置)');

(async () => {
  try {
    // 測試 Auth API（這是 Middleware 主要使用的）
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        'apikey': supabaseAnonKey,
      },
    });
    
    if (authResponse.ok) {
      const healthData = await authResponse.json();
      console.log('✅ Auth API 連接成功！');
      console.log(`   Auth 服務狀態: ${healthData.status || 'healthy'}`);
      console.log(`   ✅ Middleware 可以正常使用此配置進行認證`);
    } else {
      console.error(`❌ Auth API 測試失敗: ${authResponse.status} ${authResponse.statusText}`);
      console.error(`   ❌ Middleware 無法使用此配置進行認證！`);
      console.error(`   請確認從 Supabase Dashboard 複製的 ANON KEY 是否正確`);
      
      // 提供詳細的錯誤信息
      const errorText = await authResponse.text();
      console.error(`   錯誤詳情: ${errorText.substring(0, 200)}`);
    }

    // 測試 getUser API（Middleware 實際使用的）
    console.log('\n3️⃣ 測試 getUser API (Middleware 實際使用):');
    const getUserResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    
    if (getUserResponse.ok || getUserResponse.status === 401) {
      // 401 是正常的，因為沒有有效的 session token
      console.log('✅ getUser API 端點可訪問');
      console.log(`   狀態碼: ${getUserResponse.status} (401 是正常的，表示需要 session token)`);
      console.log(`   ✅ Middleware 可以正常調用此 API`);
    } else {
      console.error(`❌ getUser API 測試失敗: ${getUserResponse.status} ${getUserResponse.statusText}`);
      console.error(`   ❌ Middleware 可能無法正常運作！`);
    }

  } catch (error) {
    console.error('❌ 連接錯誤:', error instanceof Error ? error.message : error);
    console.error('   ❌ Middleware 配置有問題！');
  }
})();

console.log('\n' + '='.repeat(60));
console.log('\n📝 驗證結果說明：');
console.log('1. 如果 Auth API 連接成功 → Middleware 配置正確 ✅');
console.log('2. 如果 Auth API 連接失敗 → 請檢查 ANON KEY 是否正確 ❌');
console.log('3. 請確認從 Supabase Dashboard > Settings > API 複製的是 anon public key');
console.log('4. 確認 Project URL 中的 Project ID 與 Cookie 名稱匹配');
