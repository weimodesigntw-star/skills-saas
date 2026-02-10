# ⚡ 快速修復指南

## 🚨 當前問題

**錯誤**：`Could not find the table 'public.categories'`

**原因**：`categories` 表尚未在 Supabase 中創建

---

## ✅ 解決方案（3 步驟）

### Step 1: 執行 SQL Migration

1. **打開 Supabase Dashboard**
   - 訪問：https://app.supabase.com
   - 登入並選擇您的專案

2. **打開 SQL Editor**
   - 點擊左側選單的 **SQL Editor**
   - 點擊 **New Query**

3. **複製並執行 SQL**
   - 打開文件：`supabase/migrations/002_complete_setup.sql`
   - **複製全部內容**（149 行）
   - 貼上到 SQL Editor
   - 點擊 **RUN** 按鈕（或按 Cmd/Ctrl + Enter）

4. **確認成功**
   - 右下角應顯示 **"Success"**
   - 如果出現錯誤，請檢查錯誤訊息

### Step 2: 驗證表已創建

**方法 1: 在 Supabase Dashboard**
- 點擊左側選單的 **Table Editor**
- 應該看到 `categories` 表

**方法 2: 執行驗證腳本**
```bash
npx tsx scripts/verify-db.ts
```

應該顯示：`✅ categories 表存在！`

### Step 3: 執行種子數據

確認表存在後：
```bash
npx tsx scripts/seed-categories.ts
```

---

## 📋 SQL 文件位置

完整 SQL 內容在：
```
supabase/migrations/002_complete_setup.sql
```

---

## 🎯 執行後預期結果

### 驗證腳本輸出：
```
✅ categories 表存在！
✅ 插入權限正常
✅ 數據庫設置驗證完成！
```

### 種子數據腳本輸出：
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

## 🚨 如果仍有問題

### 問題 1: SQL 執行失敗

**檢查**：
- 確認 Supabase 專案運行中
- 檢查錯誤訊息
- 確認 SQL 語法正確

### 問題 2: 表存在但仍報錯

**可能原因**：
- RLS 策略限制
- API Key 權限不足

**解決方案**：
- 檢查 RLS 策略設置
- 確認使用正確的 API Key（anon public key）

---

**完成 SQL Migration 後，請告訴我，我會立即執行種子數據腳本！** 🚀
