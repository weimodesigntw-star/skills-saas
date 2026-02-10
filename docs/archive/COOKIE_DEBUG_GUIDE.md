# 🔍 Cookies 調試指南

## 📍 在哪裡查看 Cookies

### 1. Network 標籤（查看請求中的 Cookies）

**步驟：**
1. 打開 DevTools（F12）
2. 切換到 **Network** 標籤
3. 選擇一個請求（例如 `categories`）
4. 點擊 **Headers** 標籤
5. 查看 **Request Headers** 中的 `Cookie` 欄位

**應該看到的 Supabase Cookies：**
- `sb-<project-ref>-auth-token` - 認證 token
- 或其他以 `sb-` 開頭的 cookies

---

### 2. Application 標籤（查看所有 Cookies）

**步驟：**
1. 打開 DevTools（F12）
2. 切換到 **Application** 標籤
3. 左側選單選擇 **Cookies** > `http://localhost:3000`
4. 這裡會顯示所有設置的 cookies 及其詳細信息

**可以查看：**
- Cookie 名稱
- Cookie 值
- Domain
- Path
- Expires/Max-Age
- Size
- HttpOnly
- Secure
- SameSite

---

### 3. Console 中手動檢查

**在 Console 中輸入：**
```javascript
// 查看所有 cookies
document.cookie

// 查找 Supabase cookies
document.cookie.split('; ').filter(c => c.includes('sb-'))

// 檢查是否有認證相關的 cookies
document.cookie.includes('auth-token')
```

---

## 🐛 常見問題

### 問題 1：登入後看不到 Supabase Cookies

**可能原因：**
1. `createBrowserClient` 沒有正確設置 cookies
2. Cookies 的 domain/path 設置不正確
3. 瀏覽器阻止了 cookies（檢查瀏覽器設置）

**解決方案：**
- 檢查 `lib/supabase/client.ts` 的配置
- 確保使用 `@supabase/ssr` 的 `createBrowserClient`
- 檢查瀏覽器的 cookies 設置

---

### 問題 2：Cookies 設置了但 Middleware 讀取不到

**可能原因：**
1. Middleware 的 cookies 讀取邏輯有問題
2. Request 和 Response cookies 沒有正確同步

**解決方案：**
- 檢查 `middleware.ts` 中的 cookies 處理邏輯
- 確保 `request.cookies` 和 `response.cookies` 都正確更新

---

### 問題 3：Cookies 在 Application 標籤中但請求中沒有

**可能原因：**
1. Cookies 的 domain/path 不匹配
2. Cookies 被標記為 HttpOnly，無法在 JavaScript 中讀取
3. SameSite 設置導致 cookies 沒有發送

**解決方案：**
- 檢查 cookies 的 domain 和 path 設置
- 確保 domain 是 `localhost` 或正確的域名
- 確保 path 是 `/` 或包含目標路徑

---

## 🔧 調試步驟

### 步驟 1：登入前檢查
1. 打開 **Application** > **Cookies** > `http://localhost:3000`
2. 記錄現有的 cookies
3. 確認沒有 Supabase 相關的 cookies

### 步驟 2：執行登入
1. 打開 **Network** 標籤
2. 勾選 **Preserve log**（保留日誌）
3. 輸入帳號密碼並點擊登入
4. 查找登入相關的請求（通常是 `/auth/v1/token`）

### 步驟 3：檢查登入請求的 Response
1. 選擇登入請求
2. 查看 **Response Headers** 中的 `Set-Cookie` 欄位
3. 確認是否有設置 Supabase cookies

### 步驟 4：登入後檢查
1. 打開 **Application** > **Cookies** > `http://localhost:3000`
2. 確認是否有新的 Supabase cookies
3. 檢查 cookies 的 domain、path、expires 等屬性

### 步驟 5：檢查後續請求
1. 查看 `categories` 請求的 **Request Headers**
2. 確認 `Cookie` 欄位中是否包含 Supabase cookies
3. 如果沒有，說明 cookies 沒有正確發送

---

## 📝 預期的 Supabase Cookies

登入成功後，應該會看到類似以下的 cookies：

```
sb-<project-ref>-auth-token
sb-<project-ref>-auth-token.0
sb-<project-ref>-auth-token.1
```

其中 `<project-ref>` 是您的 Supabase 專案 ID。

---

## 🚨 如果還是找不到 Cookies

請檢查：
1. **瀏覽器設置**：確保允許 cookies
2. **隱私模式**：不要在隱私模式下測試
3. **瀏覽器擴展**：某些擴展可能會阻止 cookies
4. **Supabase 配置**：檢查 `.env.local` 中的配置是否正確

---

## 💡 快速檢查命令

在 Console 中執行：

```javascript
// 檢查 Supabase client 是否正確初始化
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
console.log('Supabase client:', supabase);

// 檢查 session
supabase.auth.getSession().then(({ data }) => {
  console.log('Session:', data.session);
});

// 檢查 cookies
console.log('All cookies:', document.cookie);
console.log('Supabase cookies:', document.cookie.split('; ').filter(c => c.includes('sb-')));
```
