# 🔍 診斷 Cookie 設置問題

## 📊 當前狀況

從終端機日誌和瀏覽器截圖可以看到：

1. **終端機顯示**：
   - Cookie 存在：`sb-ucwcavjnqalnxnisiuha-auth-token`
   - Cookie 值長度：1903 字符
   - Env Key 正確：`eyJ...`（標準 anon Key）

2. **瀏覽器顯示**：
   - Application > Cookies 中**沒有任何 Cookie**
   - 這說明 Cookie **沒有被正確設置到瀏覽器**

## 🔍 診斷步驟

### Step 1: 檢查 Network 請求中的 Set-Cookie

1. **打開瀏覽器開發者工具** (F12)
2. **切換到 Network 標籤**
3. **勾選 "Preserve log"**（保留日誌）
4. **清除 Network 日誌**
5. **輸入帳號密碼並登入**
6. **查找登入相關的請求**：
   - 尋找 `/auth/v1/token` 或類似的 Supabase Auth 請求
   - 或者查找 POST 請求到 `/login`

7. **檢查 Response Headers**：
   - 點擊登入請求
   - 查看 **Response Headers**
   - 尋找 **`Set-Cookie`** 欄位
   - **應該會看到類似**：
     ```
     Set-Cookie: sb-ucwcavjnqalnxnisiuha-auth-token=...; Path=/; ...
     ```

8. **如果沒有看到 Set-Cookie**：
   - ❌ 說明服務器沒有發送 Cookie
   - 可能是 `createBrowserClient` 沒有正確設置 Cookie

9. **如果看到 Set-Cookie 但瀏覽器沒有保存**：
   - 檢查 Cookie 的屬性：
     - `SameSite`：應該是 `Lax` 或 `None`
     - `Secure`：如果是 `true`，需要 HTTPS（localhost 通常可以）
     - `Domain`：應該是 `localhost` 或空
     - `Path`：應該是 `/`

### Step 2: 檢查 Console 日誌

登入時，打開 **Console 標籤**，應該會看到：

```
登入成功，session: {...}
準備重定向到: /dashboard/categories
Session 驗證成功 (嘗試 X/5)
當前 Cookies: ...
是否有 Supabase Cookie: true/false
最終 Cookies: ...
最終是否有 Supabase Cookie: true/false
執行重定向到: ...
```

**如果看到 "是否有 Supabase Cookie: false"**：
- 說明 `createBrowserClient` 沒有正確設置 Cookie
- 可能需要檢查 Supabase SSR 版本或配置

### Step 3: 檢查 Supabase SSR 版本

執行以下命令檢查版本：

```bash
npm list @supabase/ssr
```

**應該使用**：`@supabase/ssr@^0.5.0` 或更新版本

如果版本太舊，更新：

```bash
npm install @supabase/ssr@latest
```

---

## 🔧 可能的解決方案

### 方案 1: 檢查瀏覽器設置

1. **檢查瀏覽器是否阻止 Cookies**
   - Chrome: Settings > Privacy and security > Cookies and other site data
   - 確保允許 Cookies

2. **檢查是否在隱私模式**
   - 不要在隱私模式下測試
   - 使用正常模式

3. **檢查瀏覽器擴展**
   - 某些擴展（如廣告攔截器）可能會阻止 Cookies
   - 嘗試禁用擴展後測試

### 方案 2: 檢查 Supabase Client 配置

確認 `lib/supabase/client.ts` 使用正確的配置：

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 方案 3: 手動檢查 Cookie 設置

在 Console 中執行：

```javascript
// 檢查當前 Cookies
console.log('Current cookies:', document.cookie);

// 嘗試手動設置 Cookie（測試用）
document.cookie = "test=value; path=/";
console.log('After setting test cookie:', document.cookie);

// 檢查 Supabase Cookie
const hasSupabaseCookie = document.cookie.includes('sb-');
console.log('Has Supabase cookie:', hasSupabaseCookie);
```

---

## 📝 請提供以下資訊

1. **Network 標籤中的 Set-Cookie 頭**（登入請求的 Response Headers）
2. **Console 日誌**（登入時的輸出）
3. **Supabase SSR 版本**（`npm list @supabase/ssr`）
4. **瀏覽器類型和版本**

這些資訊可以幫助我們進一步診斷問題。
