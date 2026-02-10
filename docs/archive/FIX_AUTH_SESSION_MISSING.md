# 🔧 修復 "Auth session missing!" 錯誤

## 🎯 問題診斷

根據終端機日誌：
- ✅ Cookie 存在：`sb-ucwcavjn...`
- ❌ Middleware 讀不到用戶：`Has User? false`
- ❌ 錯誤訊息：`Auth session missing!`

**根本原因**：`.env.local` 中的 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 與 Supabase 專案不匹配，或已過期。

---

## 🚀 3 分鐘修復方案

### Step 1: 驗證當前配置

執行驗證腳本檢查當前配置：

```bash
npx tsx scripts/verify-env.ts
```

這會告訴您：
- URL 是否正確
- Key 格式是否正確
- 是否能連接到 Supabase

---

### Step 2: 從 Supabase Dashboard 獲取正確的 Key

1. **打開 Supabase Dashboard**
   - 訪問：https://app.supabase.com
   - 登入並選擇您的專案（Project ID: `ucwcavjnqalnxnisiuha`）

2. **進入 API 設置**
   - 點擊左下角 **Settings** (齒輪圖標)
   - 點擊 **API**

3. **複製正確的憑證**
   - **Project URL**：應該是 `https://ucwcavjnqalnxnisiuha.supabase.co`
   - **anon public** key：複製完整的 key
     - 舊格式：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (很長的 JWT)
     - 新格式：`sb_publishable_...` (以 sb_publishable_ 開頭)

4. **確認 Project ID 匹配**
   - Cookie 名稱是 `sb-ucwcavjn...`
   - 所以 Project ID 應該是 `ucwcavjnqalnxnisiuha`
   - 確保 URL 中的 Project ID 與此匹配

---

### Step 3: 更新 .env.local

打開 `.env.local` 文件，確保內容如下：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ucwcavjnqalnxnisiuha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=您的完整_anon_public_key_從_Supabase_Dashboard複製
```

**重要注意事項**：
- ✅ 不要有多餘的空格
- ✅ 不要有引號（除非值本身包含特殊字符）
- ✅ Key 必須是完整的，不能截斷
- ✅ 確保複製的是 **anon public** key，不是 **service_role** key

---

### Step 4: 重啟開發伺服器

**必須執行**：Next.js 只在啟動時讀取環境變數！

```bash
# 1. 停止當前伺服器
# 在終端機按 Ctrl + C

# 2. 重新啟動
npm run dev
```

---

### Step 5: 清除瀏覽器 Cookies

**重要**：舊的 Cookie 是用錯誤的 Key 創建的，必須清除！

1. **打開瀏覽器開發者工具**
   - 按 `F12` 或 `Cmd + Option + I` (Mac) / `Ctrl + Shift + I` (Windows)

2. **清除網站數據**
   - 切換到 **Application** 標籤
   - 左側選單選擇 **Storage**
   - 點擊 **Clear site data** 按鈕
   - 確認清除所有 Cookies 和 Local Storage

3. **或者手動清除 Cookies**
   - 在 **Application** > **Cookies** > `http://localhost:3000`
   - 刪除所有以 `sb-` 開頭的 Cookies

---

### Step 6: 重新測試登入

1. **訪問登入頁面**
   - 打開：http://localhost:3000/login

2. **輸入帳號密碼登入**

3. **觀察終端機日誌**
   - 應該看到：`[Middleware] Has User? true`
   - 不應該看到：`Auth session missing!`

4. **確認跳轉成功**
   - 應該自動跳轉到 `/dashboard/categories`
   - 不應該出現無限循環

---

## 🔍 驗證清單

完成上述步驟後，檢查以下項目：

- [ ] `.env.local` 中的 URL 包含正確的 Project ID (`ucwcavjnqalnxnisiuha`)
- [ ] `.env.local` 中的 ANON KEY 是從 Supabase Dashboard 複製的完整 key
- [ ] 開發伺服器已重啟（修改 .env.local 後）
- [ ] 瀏覽器 Cookies 已清除
- [ ] 終端機顯示 `[Middleware] Has User? true`（登入後）
- [ ] 登入後能成功跳轉到 dashboard，沒有無限循環

---

## 🆘 如果還是失敗

### 檢查項目 1：Key 格式

執行驗證腳本：
```bash
npx tsx scripts/verify-env.ts
```

如果顯示連接失敗，請：
1. 再次確認從 Supabase Dashboard 複製的 key
2. 確保複製的是 **anon public** key，不是其他 key
3. 檢查 key 是否完整（沒有被截斷）

### 檢查項目 2：Supabase 專案狀態

1. 確認 Supabase 專案是 **Active** 狀態
2. 確認沒有達到 API 配額限制
3. 確認專案的 Project ID 確實是 `ucwcavjnqalnxnisiuha`

### 檢查項目 3：終端機日誌

登入後，終端機應該顯示：
```
[Middleware] Path: /dashboard/categories
[Middleware] Total Cookies: X (應該 > 0)
[Middleware] Supabase Cookies: X (應該 > 0)
[Middleware] Has User? true  ← 這是最重要的！
```

如果還是 `false`，請提供：
- 終端機的完整日誌
- `.env.local` 的內容（隱藏 key 的後半部分）

---

## 📝 快速參考

**Supabase Dashboard 路徑**：
```
Settings (左下角齒輪) > API > Project URL & anon public key
```

**驗證命令**：
```bash
npx tsx scripts/verify-env.ts
```

**清除 Cookies 快捷方式**：
```
F12 > Application > Storage > Clear site data
```
