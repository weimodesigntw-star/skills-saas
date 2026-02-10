# ⚡ 快速修復 "Auth session missing!" 錯誤

## 🎯 問題確認

驗證腳本顯示：
- ✅ URL 正確：`https://ucwcavjnqalnxnisiuha.supabase.co`
- ✅ Project ID 匹配：`ucwcavjnqalnxnisiuha`
- ✅ Key 格式正確：Publishable Key (新格式)
- ❌ **連接失敗：401 Unauthorized**

**結論**：`NEXT_PUBLIC_SUPABASE_ANON_KEY` 不正確或已過期！

---

## 🚀 立即修復步驟（3 分鐘）

### Step 1: 從 Supabase Dashboard 獲取正確的 Key

1. **打開 Supabase Dashboard**
   - 訪問：https://app.supabase.com
   - 登入並選擇專案：`ucwcavjnqalnxnisiuha`

2. **進入 API 設置**
   - 點擊左下角 **Settings** (⚙️ 齒輪圖標)
   - 點擊 **API**

3. **複製正確的 Key**
   - 找到 **Project API keys** 區塊
   - 複製 **anon public** key（不是 service_role！）
   - 應該是類似 `sb_publishable_...` 或 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` 的格式

---

### Step 2: 更新 .env.local

打開 `.env.local`，將 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 替換為剛複製的 key：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ucwcavjnqalnxnisiuha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=從_Supabase_Dashboard_複製的完整_key
```

**重要**：
- ✅ 確保 key 完整（沒有被截斷）
- ✅ 不要有多餘的空格或引號
- ✅ 保存文件

---

### Step 3: 重啟開發伺服器

**必須執行**：Next.js 只在啟動時讀取環境變數！

```bash
# 1. 停止當前伺服器（在終端機按 Ctrl + C）

# 2. 重新啟動
npm run dev
```

---

### Step 4: 驗證配置

執行驗證腳本確認修復成功：

```bash
npx tsx scripts/verify-env.ts
```

**預期輸出**：
```
✅ Supabase 連接成功！
```

如果還是失敗，請：
1. 再次確認從 Supabase Dashboard 複製的 key
2. 確保複製的是 **anon public** key
3. 檢查 key 是否完整

---

### Step 5: 清除瀏覽器 Cookies

**必須執行**：舊的 Cookie 是用錯誤的 Key 創建的！

1. **打開開發者工具**
   - 按 `F12` 或 `Cmd + Option + I` (Mac)

2. **清除網站數據**
   - 切換到 **Application** 標籤
   - 左側選單選擇 **Storage**
   - 點擊 **Clear site data**
   - 確認清除

3. **或者手動刪除 Cookies**
   - **Application** > **Cookies** > `http://localhost:3000`
   - 刪除所有以 `sb-` 開頭的 Cookies

---

### Step 6: 重新測試登入

1. **訪問登入頁面**
   - http://localhost:3000/login

2. **輸入帳號密碼登入**

3. **觀察終端機日誌**
   - ✅ 應該看到：`[Middleware] Has User? true`
   - ❌ 不應該看到：`Auth session missing!`

4. **確認跳轉成功**
   - ✅ 自動跳轉到 `/dashboard/categories`
   - ❌ 不應該出現無限循環

---

## ✅ 修復完成檢查清單

- [ ] 從 Supabase Dashboard 複製了正確的 anon public key
- [ ] 更新了 `.env.local` 文件
- [ ] 重啟了開發伺服器
- [ ] 驗證腳本顯示「連接成功」
- [ ] 清除了瀏覽器 Cookies
- [ ] 登入後終端機顯示 `Has User? true`
- [ ] 登入後成功跳轉，沒有無限循環

---

## 🆘 如果還是失敗

請提供以下資訊：

1. **驗證腳本輸出**：
   ```bash
   npx tsx scripts/verify-env.ts
   ```

2. **終端機日誌**（登入後的 middleware 日誌）

3. **Supabase Dashboard 截圖**（Settings > API 頁面，隱藏敏感資訊）

---

## 📝 快速參考

**Supabase Dashboard 路徑**：
```
Settings (左下角⚙️) > API > Project API keys > anon public
```

**驗證命令**：
```bash
npx tsx scripts/verify-env.ts
```

**清除 Cookies**：
```
F12 > Application > Storage > Clear site data
```
