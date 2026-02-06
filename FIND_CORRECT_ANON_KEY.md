# 🔑 找到正確的 anon (public) Key

## ⚠️ 重要區別

您剛才提供的是 **Secret Key** (`sb_secret_...`)，但我們需要的是 **anon (public) Key** (`eyJ...`)。

### Key 類型說明：

1. **anon (public) Key** - 我們需要的 ✅
   - 格式：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - 以 `eyJ` 開頭
   - 非常長（> 200 字符）
   - 用於：客戶端、Middleware、瀏覽器

2. **Secret Key** - 您剛才提供的 ❌
   - 格式：`sb_secret_...`
   - 用於：服務器端、Server Actions、後端函數
   - **不要用在 Middleware 或客戶端！**

3. **Publishable Key** - 之前使用的 ❌
   - 格式：`sb_publishable_...`
   - 新版本，可能與 Supabase SSR 不兼容

---

## 🎯 如何找到正確的 anon (public) Key

### 方法 1: 在 Supabase Dashboard 中查找

1. **打開 Supabase Dashboard**
   - 訪問：https://app.supabase.com
   - 選擇專案：`ucwcavjnqalnxnisiuha`

2. **進入 API 設置**
   - 點擊左下角 **Settings** (⚙️ 齒輪圖標)
   - 點擊 **API** 或 **API Keys**

3. **切換到 Legacy Keys 標籤**
   - 找到標籤頁：**"Legacy anon, service_role API keys"** 或 **"舊版匿名服務角色 API 金鑰"**
   - 點擊該標籤

4. **找到 anon (public) Key**
   - 應該會看到 **"anon public"** 或 **"anon (public)"**
   - Key 值應該以 `eyJ` 開頭
   - 非常長（> 200 字符）
   - 點擊 "Copy" 按鈕複製

### 方法 2: 檢查您之前提供的 Key

您之前已經提供過一個標準 anon Key：
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjd2NhdmpucWFsbnhuaXNpdWhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTA5NDAsImV4cCI6MjA4NTg2Njk0MH0.BSxmR1wEIT5Akwuypw7afhPorggjl1SXdgFqTNe0xsk
```

這個 Key 是正確的！✅

---

## ✅ 當前配置狀態

讓我檢查一下 `.env.local` 是否已經使用了正確的 anon Key...
