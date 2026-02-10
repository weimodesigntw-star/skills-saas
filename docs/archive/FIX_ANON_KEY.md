# 🔧 修復：換回標準 anon Key

## 🎯 問題診斷

**當前問題**：
- 使用新版 Publishable Key：`sb_publishable_mcSK_...`
- Supabase SSR 和 Next.js Middleware 可能不完全支持新格式
- 導致認證失敗，無法建立 Session

**解決方案**：
- 換回標準 anon Key（JWT 格式，以 `eyJ` 開頭）

---

## 🚀 修復步驟

### Step 1: 從 Supabase Dashboard 獲取標準 anon Key

1. **打開 Supabase Dashboard**
   - 訪問：https://app.supabase.com
   - 選擇專案：`ucwcavjnqalnxnisiuha`

2. **進入 API 設置**
   - 點擊左下角 **Settings** (⚙️ 齒輪圖標)
   - 點擊 **API**

3. **找到標準 anon Key**
   - 尋找 **anon (public) key** 或 **Legacy Keys**
   - **不要使用 Publishable Key**
   - 標準 anon Key 的特徵：
     - ✅ 非常長（通常 > 200 字元）
     - ✅ 以 `eyJ` 開頭（JWT 格式）
     - ✅ 格式類似：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2NhdmpucWFsbnhuaXNpdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3M...`

4. **如果看不到 anon Key**
   - 尋找 "Legacy Keys" 或 "Reveal keys" 按鈕
   - 或者切換到 "Legacy anon, service_role API keys" 標籤

---

### Step 2: 更新 .env.local

打開 `.env.local` 文件，將 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 替換為標準 anon Key：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ucwcavjnqalnxnisiuha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2NhdmpucWFsbnhuaXNpdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3M...（完整的長字串）
```

**重要**：
- ✅ 確保 key 完整（沒有被截斷）
- ✅ 確保以 `eyJ` 開頭
- ✅ 保存文件

---

### Step 3: 重啟開發伺服器

**必須執行**：修改 `.env.local` 後必須重啟服務器！

```bash
# 1. 停止當前服務器（在終端機按 Ctrl + C）

# 2. 重新啟動
npm run dev
```

---

### Step 4: 清除瀏覽器 Cookies 並測試登入

1. **清除 Cookies**
   - F12 > Application > Storage > Clear site data
   - 或者手動刪除所有 `sb-` 開頭的 Cookie

2. **訪問登入頁面**
   - http://localhost:3000/login

3. **輸入帳號密碼登入**

4. **觀察終端機日誌**

**預期結果**：
```
[Middleware] Path: /dashboard/categories
[Middleware] Total Cookies: 2 (或更多)  ← 關鍵！
[Middleware] Supabase Cookies: 1
[Middleware] Has User? true  ← 關鍵！
[Middleware] User logged in, redirecting to dashboard
```

---

## ✅ 驗證清單

完成修復後，檢查：

- [ ] `.env.local` 中的 ANON KEY 以 `eyJ` 開頭
- [ ] ANON KEY 長度 > 200 字元
- [ ] 開發服務器已重啟
- [ ] 瀏覽器 Cookies 已清除
- [ ] 登入後終端機顯示 `Total Cookies: 2+`
- [ ] 登入後終端機顯示 `Has User? true`
- [ ] 成功跳轉到 `/dashboard/categories`

---

## 🔍 如果還是失敗

如果換回標準 anon Key 後還是失敗，請提供：

1. **終端機日誌**（登入後的 middleware 輸出）
2. **ANON KEY 的前 20 字元**（確認格式正確）
3. **Supabase Dashboard 截圖**（顯示 anon Key 的位置）

---

## 📝 參考資料

- [Supabase Auth Keys 說明](https://supabase.com/docs/guides/api/api-keys)
- [Supabase SSR 文檔](https://supabase.com/docs/guides/auth/server-side/nextjs)
