# ⚡ 立即執行指南

## 🎯 當前狀態

✅ **已完成**：
- SQL Migration 文件已準備 (`supabase/migrations/002_complete_setup.sql`)
- 環境變數範例文件已創建 (`.env.local`)

⚠️ **需要手動完成**：
1. 在 Supabase 執行 SQL
2. 填入 Supabase 憑證到 `.env.local`
3. 啟動開發伺服器

---

## 🚀 三步執行流程

### Step 1: 執行 SQL Migration（必須）

**操作步驟**：

1. **打開 Supabase Dashboard**
   - 訪問：https://app.supabase.com
   - 登入並選擇您的專案

2. **打開 SQL Editor**
   - 點擊左側選單的 **SQL Editor**
   - 點擊 **New Query**

3. **複製 SQL 內容**
   - 打開文件：`supabase/migrations/002_complete_setup.sql`
   - 複製全部內容（約 120 行）

4. **執行 SQL**
   - 貼上到 SQL Editor
   - 點擊 **RUN** 按鈕（或按 Cmd/Ctrl + Enter）
   - 等待執行完成

5. **確認成功**
   - 右下角應顯示 **"Success"**
   - 如果出現錯誤，請檢查錯誤訊息

**快速驗證**：
```sql
-- 在 SQL Editor 執行此查詢確認
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'categories';
-- 應該返回 1 行
```

---

### Step 2: 設置環境變數（必須）

**操作步驟**：

1. **獲取 Supabase 憑證**
   - 在 Supabase Dashboard
   - 進入 **Settings** (左下角齒輪) > **API**
   - 複製：
     - **Project URL**
     - **anon public** key

2. **編輯 `.env.local`**
   ```bash
   # 在專案根目錄
   # 使用您喜歡的編輯器打開 .env.local
   ```

3. **填入憑證**
   ```env
   NEXT_PUBLIC_SUPABASE_URL="您的 Project URL"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="您的 anon public key"
   ```

4. **保存文件**
   - 確保文件已保存
   - 確認沒有多餘的空格或引號

---

### Step 3: 啟動開發伺服器（必須）

**操作步驟**：

```bash
# 在終端機執行
npm run dev
```

**預期輸出**：
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
- ready started server on 0.0.0.0:3000
```

**重要**：
- ⚠️ 如果環境變數未設置，會看到 Supabase 連接錯誤
- ⚠️ 設置環境變數後，**必須重啟伺服器**（Ctrl+C 然後重新執行 `npm run dev`）

---

### Step 4: 插入測試數據（可選但推薦）

**前置條件**：
- ✅ SQL Migration 已執行
- ✅ 環境變數已設置
- ✅ 開發伺服器正在運行

**執行命令**：
```bash
# 在新的終端機視窗執行（或停止開發伺服器後執行）
npx tsx scripts/seed-categories.ts
```

**預期輸出**：
```
🌱 開始插入種子數據...

✅ 已插入根分類：
   - 服飾
   - 3C
   - 傢俱

✅ 已插入「服飾」子分類：
   - 男裝
   - 女裝

✅ 已插入「3C」子分類：
   - 手機
   - 筆記本電腦

🎉 種子數據插入完成！
```

---

## 🧪 驗證發射成功

### 1. 訪問應用

打開瀏覽器訪問：
```
http://localhost:3000/dashboard/categories
```

### 2. 預期畫面

- ✅ 看到分類管理頁面
- ✅ 如果執行了種子數據，應該看到「服飾、3C、傢俱」
- ✅ 操作選單（三點圖標）可見
- ✅ 沒有錯誤訊息

### 3. 快速測試

- **展開分類**：點擊「服飾」左側的箭頭
- **拖拽測試**：嘗試拖動「手機」到「服飾」下面
- **編輯測試**：點擊操作選單 > 編輯

---

## 🚨 常見問題

### 問題 1: SQL 執行失敗

**錯誤訊息**：`relation "categories" already exists`

**解決方案**：
- 這是正常的，表示表已存在
- 可以跳過或使用 `DROP TABLE IF EXISTS categories CASCADE;` 重新創建

### 問題 2: 環境變數不生效

**症狀**：API 調用失敗，顯示 "Supabase URL not found"

**解決方案**：
1. 確認 `.env.local` 已保存
2. **必須重啟開發伺服器**（Ctrl+C 然後 `npm run dev`）
3. 確認變數名稱正確（`NEXT_PUBLIC_` 前綴）

### 問題 3: 種子數據插入失敗

**錯誤訊息**：`Unauthorized` 或 `RLS policy violation`

**解決方案**：
1. 確認 SQL Migration 已執行（包含 RLS 策略）
2. 確認環境變數已設置
3. 檢查 Supabase 專案是否運行中

---

## ✅ 完成檢查清單

- [ ] Step 1: SQL Migration 已執行（顯示 Success）
- [ ] Step 2: `.env.local` 已填入 Supabase 憑證
- [ ] Step 3: 開發伺服器已啟動（`npm run dev`）
- [ ] Step 4: 可以訪問 http://localhost:3000/dashboard/categories
- [ ] Step 5: （可選）種子數據已插入

---

## 🎉 發射成功！

如果所有步驟都完成，恭喜！您的應用程式已經成功發射！

現在可以：
- 開始測試功能
- 參考 `FINAL_TESTING_GUIDE.md` 進行完整測試
- 開始自定義開發

---

**祝使用愉快！🚀**
