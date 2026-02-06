/**
 * 診斷 Cookie 解析問題
 * 分析為什麼 Cookie 存在但 Middleware 無法解析
 */

console.log('🔍 Cookie 解析問題診斷\n');
console.log('='.repeat(60));

console.log('\n📋 問題分析：');
console.log('從終端機日誌可以看到：');
console.log('  ✅ Cookie 存在: sb-ucwcavjnqalnxnisiuha-auth-token');
console.log('  ❌ Has User? false');
console.log('  ❌ Auth Error: Auth session missing!');

console.log('\n💡 可能的原因：');
console.log('1. Cookie 是用舊的/錯誤的配置創建的');
console.log('2. Cookie 格式不正確或已損壞');
console.log('3. Supabase SSR 無法從 Cookie 中解析 session');

console.log('\n🔧 解決方案：');
console.log('='.repeat(60));
console.log('\n方案 1: 完全清除所有 Cookie（推薦）');
console.log('1. 打開瀏覽器開發者工具 (F12)');
console.log('2. Application > Cookies > http://localhost:3000');
console.log('3. 刪除所有 Cookie（不只是 sb- 開頭的）');
console.log('4. 或者使用 Clear site data');
console.log('5. 關閉瀏覽器標籤，重新打開');
console.log('6. 重新登入');

console.log('\n方案 2: 檢查 Cookie 內容');
console.log('1. F12 > Application > Cookies > http://localhost:3000');
console.log('2. 找到 sb-ucwcavjnqalnxnisiuha-auth-token');
console.log('3. 檢查 Value 是否為有效的 JSON');
console.log('4. 如果 Value 是亂碼或空，說明 Cookie 已損壞');

console.log('\n方案 3: 檢查 Supabase 配置');
console.log('1. 確認 .env.local 中的配置正確');
console.log('2. 確認服務器已重啟');
console.log('3. 確認使用的是正確的 Project ID 和 Anon Key');

console.log('\n方案 4: 使用無痕模式測試');
console.log('1. 打開無痕視窗 (Cmd+Shift+N)');
console.log('2. 訪問 http://localhost:3000/login');
console.log('3. 登入測試');
console.log('4. 如果無痕模式可以，說明是 Cookie 問題');

console.log('\n' + '='.repeat(60));
console.log('\n📝 建議執行順序：');
console.log('1. 完全清除瀏覽器所有 Cookie 和 Local Storage');
console.log('2. 關閉瀏覽器標籤');
console.log('3. 重新打開瀏覽器，訪問 http://localhost:3000/login');
console.log('4. 重新登入');
console.log('5. 觀察終端機是否顯示 Has User? true');
