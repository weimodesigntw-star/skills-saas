# 🧪 認證系統測試指南

## ✅ 已建立的認證功能

1. **Middleware 保護** (`middleware.ts`)
   - 保護 `/dashboard` 路由
   - 未登入用戶自動重定向到 `/login`
   - 已登入用戶訪問登入頁會重定向到 dashboard

2. **登入頁面** (`app/login/page.tsx`)
   - 美觀的登入表單
   - 錯誤訊息顯示
   - 載入狀態處理

3. **認證 Actions** (`app/actions/auth.ts`)
   - `signIn()` - 登入
   - `signOut()` - 登出
   - `getCurrentUser()` - 獲取當前用戶

4. **登出功能** (`components/auth/LogoutButton.tsx`)
   - 整合到 Dashboard 導航欄
   - 點擊後自動登出並重定向

---

## 🧪 測試一：警衛攔截 (The Middleware Test)

### 操作步驟

1. **打開無痕視窗**
   - Chrome: `Cmd + Shift + N` (Mac) 或 `Ctrl + Shift + N` (Windows)
   - Safari: `Cmd + Shift + N` (Mac)
   - Firefox: `Cmd + Shift + P` (Mac) 或 `Ctrl + Shift + P` (Windows)

2. **直接訪問後台**
   - 在網址列輸入：`http://localhost:3000/dashboard/categories`
   - 按 Enter

### 預期結果

✅ **成功**：網址自動變成 `http://localhost:3000/login?redirect=%2Fdashboard%2Fcategories`，且畫面顯示登入框

❌ **失敗**：直接看到分類管理頁面（代表 Middleware 沒設定好）

### 故障排除

如果失敗，檢查：
- [ ] `middleware.ts` 文件是否存在於專案根目錄
- [ ] 開發伺服器是否已重啟（修改 middleware 後需要重啟）
- [ ] 瀏覽器控制台是否有錯誤訊息

---

## 🧪 測試二：持票入場 (The Login Test)

### 操作步驟

1. **在登入頁面輸入帳號密碼**
   - 電子郵件：`weimodesigntw@gmail.com`（或您的 Supabase 用戶）
   - 密碼：您的密碼

2. **點擊「登入」按鈕**

### 預期結果

✅ **成功**：
- 頁面跳轉回 `/dashboard/categories`
- 可以看到所有的分類資料
- 右上角顯示「登出」按鈕

❌ **失敗**：
- 顯示錯誤訊息（例如「Invalid login credentials」）
- 停留在登入頁面

### 故障排除

如果失敗，檢查：
- [ ] Supabase 中是否已建立該用戶
- [ ] 密碼是否正確
- [ ] `.env.local` 中的 Supabase 配置是否正確
- [ ] 瀏覽器控制台是否有錯誤訊息

### 建立測試用戶（如果還沒有）

在 Supabase Dashboard：
1. 前往 **Authentication** > **Users**
2. 點擊 **Add user** > **Create new user**
3. 輸入電子郵件和密碼
4. 點擊 **Create user**

---

## 🧪 測試三：離場機制 (The Logout Test)

### 操作步驟

1. **成功進入後台後**
   - 確認右上角有「登出」按鈕

2. **點擊「登出」按鈕**

### 預期結果

✅ **成功**：
- 自動重定向到 `/login` 頁面
- 無法再按「上一頁」回到後台（因為 Middleware 會攔截）
- 如果嘗試直接訪問 `/dashboard/categories`，會再次被重定向到登入頁

❌ **失敗**：
- 登出後仍能看到後台頁面
- 登出按鈕沒有反應

### 故障排除

如果失敗，檢查：
- [ ] `LogoutButton.tsx` 是否正確導入
- [ ] `signOut()` Server Action 是否正常執行
- [ ] 瀏覽器控制台是否有錯誤訊息

---

## 🔍 進階測試

### 測試四：重定向邏輯

1. **訪問受保護的路由**：`http://localhost:3000/dashboard/categories`
2. **被重定向到**：`http://localhost:3000/login?redirect=%2Fdashboard%2Fcategories`
3. **登入成功後**：應該自動跳轉回 `/dashboard/categories`

### 測試五：已登入用戶訪問登入頁

1. **已登入狀態下訪問**：`http://localhost:3000/login`
2. **預期結果**：自動重定向到 `/dashboard/categories`

---

## 📋 完整測試檢查清單

- [ ] **測試一**：無痕視窗訪問後台 → 被重定向到登入頁 ✅
- [ ] **測試二**：輸入正確帳號密碼 → 成功登入並看到分類資料 ✅
- [ ] **測試三**：點擊登出 → 成功登出並重定向到登入頁 ✅
- [ ] **測試四**：登入後重定向邏輯正常 ✅
- [ ] **測試五**：已登入用戶訪問登入頁 → 自動重定向 ✅

---

## 🚀 下一步

完成所有測試後，您可以：

1. **自定義登入頁面樣式**
2. **添加「記住我」功能**
3. **添加「忘記密碼」功能**
4. **整合社交登入（Google、GitHub 等）**
5. **添加用戶資料頁面**

---

## 📚 相關文檔

- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
