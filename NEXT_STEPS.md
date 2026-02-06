# 🎯 下一步行動指南

## ✅ Step 1 完成確認

根據您的 Supabase SQL Editor 截圖，**SQL Migration 已成功執行**！

您可以看到：
- ✅ "完成!" 註釋確認設置成功
- ✅ `categories` 表和 `delete_category_cascade()` 函數已創建

---

## 🚀 繼續執行：Step 2 & 3

### Step 2: 設置環境變數（必須）

**操作步驟**：

1. **獲取 Supabase 憑證**
   - 在 Supabase Dashboard（您當前所在的頁面）
   - 點擊左側選單的 **Settings** (齒輪圖標)
   - 進入 **API** 頁面
   - 複製：
     - **Project URL**（例如：`https://xxxxx.supabase.co`）
     - **anon public** key（很長的字串）

2. **編輯 `.env.local`**
   ```bash
   # 在專案根目錄打開 .env.local
   # 使用您喜歡的編輯器
   ```

3. **填入憑證**
   ```env
   NEXT_PUBLIC_SUPABASE_URL="您的 Project URL"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="您的 anon public key"
   ```

4. **保存文件**

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
✓ Ready in X seconds
```

**重要提醒**：
- ⚠️ 如果環境變數未設置，會看到 Supabase 連接錯誤
- ⚠️ 設置環境變數後，**必須重啟伺服器**（如果已經在運行，按 Ctrl+C 停止，然後重新執行 `npm run dev`）

---

### Step 4: 驗證設置（推薦）

**操作步驟**：

1. **訪問應用**
   - 打開瀏覽器
   - 訪問：http://localhost:3000/dashboard/categories

2. **預期結果**
   - ✅ 看到分類管理頁面
   - ✅ 可能顯示空列表或「新增分類」按鈕
   - ✅ 沒有錯誤訊息

---

### Step 5: 插入測試數據（可選但推薦）

**前置條件**：
- ✅ SQL Migration 已執行（已完成）
- ✅ 環境變數已設置
- ✅ 開發伺服器正在運行

**執行命令**：
```bash
# 在新的終端機視窗執行
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

**然後刷新瀏覽器**，應該看到分類樹！

---

## 🧪 快速功能測試

完成上述步驟後，可以測試：

1. **展開分類**：點擊「服飾」左側的箭頭
2. **拖拽測試**：嘗試拖動「手機」到「服飾」下面
3. **編輯測試**：點擊操作選單（三點圖標）> 編輯
4. **AI 測試**：在編輯對話框中點擊「✨ AI 潤飾」

---

## 🚨 如果遇到問題

### 問題：環境變數不生效

**解決方案**：
1. 確認 `.env.local` 已保存
2. **必須重啟開發伺服器**（Ctrl+C 然後 `npm run dev`）
3. 確認變數名稱正確（`NEXT_PUBLIC_` 前綴）

### 問題：種子數據插入失敗

**解決方案**：
1. 確認環境變數已設置
2. 確認開發伺服器正在運行
3. 檢查 Supabase 連接是否正常

---

## ✅ 完成檢查清單

- [x] Step 1: SQL Migration 已執行 ✅
- [ ] Step 2: `.env.local` 已填入 Supabase 憑證
- [ ] Step 3: 開發伺服器已啟動
- [ ] Step 4: 可以訪問 http://localhost:3000/dashboard/categories
- [ ] Step 5: （可選）種子數據已插入

---

**繼續加油！您已經完成最關鍵的數據庫設置！🚀**
