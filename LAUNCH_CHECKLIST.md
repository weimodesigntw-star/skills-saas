# 🚀 發射檢查清單 (Launch Checklist)

## ✅ 發射前最後確認

### Step 1: 注入靈魂 (SQL Injection) 🔴

**動作**：
1. 打開 Supabase Dashboard
2. 進入 SQL Editor
3. 打開文件：`supabase/migrations/002_complete_setup.sql`
4. 複製全部內容
5. 貼上到 SQL Editor
6. 點擊 **RUN** 按鈕

**預期訊號**：
- ✅ 右下角顯示 **"Success"**
- ✅ 沒有錯誤訊息

**驗證查詢**：
```sql
-- 確認表已創建
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'categories';

-- 確認函數已創建
SELECT proname FROM pg_proc 
WHERE proname = 'delete_category_cascade';
```

---

### Step 2: 建立連結 (Environment Link) 🔴

**動作**：

1. **創建環境變數文件**
   ```bash
   cp .env.example .env.local
   ```

2. **編輯 `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL="您的 Project URL"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="您的 anon public key"
   ```

3. **⚠️ 關鍵步驟：重啟開發伺服器**
   ```bash
   # 在終端機按 Ctrl+C 停止當前伺服器
   # 然後重新啟動
   npm run dev
   ```

**為什麼必須重啟？**
- Next.js 只在啟動時讀取環境變數
- 如果不重啟，會一直報錯說找不到 Supabase URL
- 這是 Next.js 的設計行為，不是 bug

**驗證**：
- ✅ 伺服器正常啟動
- ✅ 沒有環境變數相關錯誤

---

### Step 3: 點火 (Ignition) 🔴

**動作 1：打開瀏覽器**
- 訪問：http://localhost:3000/dashboard/categories

**動作 2：插入測試數據**
```bash
# 在終端機執行
npx tsx scripts/seed-categories.ts
```

**預期訊號**：

✅ **瀏覽器畫面**：
- 出現「服飾、3C、傢俱」三個根分類
- 可以點擊展開查看子分類
- 操作選單（三點圖標）可見

✅ **終端機輸出**：
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

## 🧪 功能測試（發射後）

### 測試 1: 拖拽功能

1. 嘗試將「手機」拖到「服飾」下面
2. 確認拖拽時顯示 DragOverlay
3. 確認排序正確更新
4. 將「手機」拖回「3C」下面

### 測試 2: 編輯功能

1. 點擊「服飾」的操作選單
2. 選擇「編輯」
3. 修改名稱和描述
4. 點擊「儲存」
5. 確認更新成功

### 測試 3: AI 功能

1. 打開編輯對話框
2. 輸入分類名稱（例如：「運動服飾」）
3. 點擊「✨ AI 潤飾」按鈕
4. 確認描述自動生成
5. 測試「復原」功能

### 測試 4: 級聯刪除

1. 創建多層級分類（例如：服飾 > 男裝 > 上衣）
2. 刪除「男裝」
3. 確認警告顯示子分類數量
4. 確認刪除後所有子分類消失

### 測試 5: 移動端適配

1. 打開瀏覽器開發者工具（F12）
2. 切換到移動設備模式（iPhone 12 Pro）
3. 確認操作選單始終可見
4. 測試所有功能在移動端正常

---

## 🎉 發射成功確認

如果以下所有項目都 ✅，恭喜！發射成功！

- [ ] SQL Migration 執行成功
- [ ] 環境變數已設置並重啟伺服器
- [ ] 可以訪問 http://localhost:3000/dashboard/categories
- [ ] 種子數據插入成功
- [ ] 可以看到分類樹
- [ ] 拖拽功能正常
- [ ] 編輯功能正常
- [ ] AI 功能正常（或至少按鈕可見）
- [ ] 移動端適配正常

---

## 🚨 故障排除

### 問題：SQL 執行失敗

**可能原因**：
- 表已存在
- 權限不足
- SQL 語法錯誤

**解決方案**：
- 檢查錯誤訊息
- 確認 Supabase 專案權限
- 使用 `IF NOT EXISTS` 避免衝突

### 問題：環境變數不生效

**可能原因**：
- 文件未保存
- 伺服器未重啟
- 變數名稱錯誤

**解決方案**：
1. 確認 `.env.local` 已保存
2. **必須重啟伺服器**（Ctrl+C 然後 `npm run dev`）
3. 檢查變數名稱是否正確（`NEXT_PUBLIC_` 前綴）

### 問題：種子數據插入失敗

**可能原因**：
- 環境變數未設置
- Supabase 連接失敗
- RLS 策略限制

**解決方案**：
1. 確認 `.env.local` 已設置
2. 確認 SQL Migration 已執行
3. 檢查 RLS 策略是否允許插入

### 問題：頁面空白或錯誤

**可能原因**：
- JavaScript 錯誤
- API 連接失敗
- 組件渲染錯誤

**解決方案**：
1. 打開瀏覽器控制台（F12）
2. 檢查錯誤訊息
3. 檢查 Network 標籤中的 API 請求
4. 確認 Supabase 連接正常

---

## 📚 相關文檔

- `LAST_MILE_CHECKLIST.md` - 詳細執行步驟
- `MAINTENANCE_GUIDE.md` - 維護指南
- `FINAL_TESTING_GUIDE.md` - 完整測試指南

---

## 🎯 發射後下一步

1. **完成功能測試** - 參考 `FINAL_TESTING_GUIDE.md`
2. **開始自定義開發** - 根據需求調整功能
3. **整合真實 AI API** - 替換臨時實現
4. **準備生產環境** - 設置生產環境變數和部署

---

**準備發射！🚀**

祝您首航順利！
