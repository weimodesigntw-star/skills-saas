# 🚀 最後一哩路執行清單 (Last Mile Checklist)

## ✅ Step 1: 授予安全憑證 (Environment Variables)

### 操作步驟：

1. **打開 Supabase Dashboard**
   - 登入 https://app.supabase.com
   - 選擇您的專案

2. **獲取 API 憑證**
   - 進入 **Settings** (左下角齒輪圖標)
   - 點擊 **API**
   - 找到以下資訊：
     - **Project URL** (例如：`https://xxxxx.supabase.co`)
     - **anon public** key (很長的一串字串)

3. **創建環境變數文件**
   ```bash
   # 在專案根目錄執行
   cp .env.example .env.local
   ```

4. **編輯 `.env.local`**
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL="您的 Project URL"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="您的 anon public key"

   # Optional: OpenAI API Key (如果使用 AI 功能)
   OPENAI_API_KEY="sk-..."
   ```

5. **保存文件**
   - 確保文件已保存
   - 如果開發伺服器正在運行，需要重啟：
     ```bash
     # 在終端機按 Ctrl+C 停止
     # 然後重新啟動
     npm run dev
     ```

---

## ✅ Step 2: 注入靈魂 (Database Injection)

### 操作步驟：

1. **打開 Supabase SQL Editor**
   - 在 Supabase Dashboard 中
   - 點擊左側選單的 **SQL Editor**
   - 點擊 **New Query**

2. **複製完整 SQL 腳本**
   - 打開文件：`supabase/migrations/002_complete_setup.sql`
   - 複製全部內容

3. **執行 SQL**
   - 貼上到 SQL Editor
   - 點擊 **RUN** 按鈕（或按 Cmd/Ctrl + Enter）
   - 等待執行完成

4. **確認成功**
   - 右下角應顯示 **"Success"**
   - 如果出現錯誤，請檢查錯誤訊息並修正

### 快速驗證：

執行以下查詢確認設置成功：

```sql
-- 檢查表是否存在
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'categories';

-- 檢查函數是否存在
SELECT proname FROM pg_proc 
WHERE proname = 'delete_category_cascade';

-- 應該各返回 1 行
```

---

## ✅ Step 3: 驗證連線 (The Handshake)

### 操作步驟：

1. **確保開發伺服器運行**
   ```bash
   # 如果還沒運行，執行：
   npm run dev
   ```

2. **訪問應用**
   - 打開瀏覽器
   - 訪問：http://localhost:3000/dashboard/categories

3. **視覺檢查**
   - ✅ 應該看到分類管理頁面
   - ✅ 可能顯示空列表或「新增分類」按鈕
   - ✅ 不應該有錯誤訊息

### 常見問題排查：

**問題 1: 頁面顯示錯誤**
- 檢查 `.env.local` 是否正確設置
- 確認 Supabase URL 和 Key 正確
- 重啟開發伺服器（Ctrl+C 然後 `npm run dev`）

**問題 2: 無法連接數據庫**
- 檢查 Supabase 專案是否運行中
- 確認 API Key 權限正確
- 檢查瀏覽器控制台錯誤訊息

**問題 3: 頁面空白**
- 檢查瀏覽器控制台（F12）
- 確認沒有 JavaScript 錯誤
- 檢查 Network 標籤中的 API 請求

---

## 🌱 Step 4: 種子數據填充 (Optional - 推薦)

### 為什麼需要種子數據？

種子數據可以讓您：
- ✅ 立即看到分類樹的效果
- ✅ 測試拖拽功能
- ✅ 驗證所有功能是否正常

### 操作步驟：

1. **確保 SQL 執行成功**
   - 完成 Step 2 的數據庫設置

2. **執行種子腳本**
   ```bash
   # 在終端機執行
   npx tsx prisma/seed.ts
   ```

3. **或者手動插入測試數據**

   在 Supabase SQL Editor 執行：

   ```sql
   -- 插入測試分類
   INSERT INTO categories (name, description, parent_id, sort_order) VALUES
   ('服飾', '服裝相關分類', NULL, 0),
   ('3C', '電子產品', NULL, 1),
   ('傢俱', '傢俱相關', NULL, 2),
   ('男裝', '男性服飾', (SELECT id FROM categories WHERE name = '服飾' LIMIT 1), 0),
   ('女裝', '女性服飾', (SELECT id FROM categories WHERE name = '服飾' LIMIT 1), 1),
   ('手機', '智慧型手機', (SELECT id FROM categories WHERE name = '3C' LIMIT 1), 0),
   ('筆記本電腦', '筆記本電腦', (SELECT id FROM categories WHERE name = '3C' LIMIT 1), 1);
   ```

4. **刷新頁面**
   - 訪問 http://localhost:3000/dashboard/categories
   - 應該看到測試分類

---

## ✅ 完成檢查清單

- [ ] Step 1: `.env.local` 已創建並填入 Supabase 憑證
- [ ] Step 2: SQL Migration 已執行成功
- [ ] Step 3: 可以訪問 http://localhost:3000/dashboard/categories
- [ ] Step 4: （可選）種子數據已插入

---

## 🎉 恭喜！

如果所有步驟都完成，您的應用程式已經：

- ✅ **環境配置完成** - 開發環境已設置
- ✅ **數據庫就緒** - categories 表和函數已創建
- ✅ **應用運行中** - 開發伺服器正常運行
- ✅ **可以開始測試** - 所有功能已就緒

### 下一步：

1. **開始測試功能**
   - 參考 `FINAL_TESTING_GUIDE.md` 進行完整測試

2. **探索功能**
   - 創建分類
   - 測試拖拽排序
   - 嘗試 AI 生成描述
   - 測試移動端適配

3. **開始開發**
   - 根據需求自定義功能
   - 整合真實的 AI API
   - 優化用戶體驗

---

## 📚 相關文檔

- `AUTOMATION_SUMMARY.md` - 自動化執行總結
- `FINAL_TESTING_GUIDE.md` - 完整測試指南
- `CODE_REVIEW_FIXES.md` - Code Review 修正記錄
- `QUICK_START.md` - 快速開始指南

---

**祝您使用愉快！🚀**
