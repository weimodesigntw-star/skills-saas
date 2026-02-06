# Skills SaaS - 分類管理系統

專業的分類管理系統，支持無限層級、拖拽排序、AI 輔助描述生成。

## 🚀 快速開始

### 1. 環境設置

```bash
# 複製環境變數範例
cp .env.example .env.local

# 編輯 .env.local，填入 Supabase 憑證
```

### 2. 數據庫設置

在 Supabase SQL Editor 執行：
- `supabase/migrations/002_complete_setup.sql` - 完整設置腳本

### 3. 啟動開發伺服器

```bash
npm run dev
```

訪問：http://localhost:3000/dashboard/categories

### 4. （可選）插入測試數據

```bash
npx tsx scripts/seed-categories.ts
```

## 📚 文檔

- `LAST_MILE_CHECKLIST.md` - **最後一哩路執行清單**（必讀！）
- `FINAL_TESTING_GUIDE.md` - 完整測試指南
- `QUICK_START.md` - 快速開始指南
- `CODE_REVIEW_FIXES.md` - Code Review 修正記錄

## ✨ 核心功能

- ✅ 無限層級分類樹
- ✅ 拖拽排序（跨層級）
- ✅ CRUD 操作（創建、讀取、更新、刪除）
- ✅ 級聯刪除（事務安全）
- ✅ AI 輔助生成描述
- ✅ 移動端適配
- ✅ 表單驗證（Zod）

## 🛠️ 技術棧

- **前端**: Next.js 14+ (App Router)
- **UI**: Shadcn/UI + Tailwind CSS
- **狀態管理**: Zustand
- **拖拽**: @dnd-kit
- **表單**: React Hook Form + Zod
- **後端**: Supabase (PostgreSQL)
- **AI**: Vercel AI SDK (預留接口)

## 📝 開發指南

詳細的開發指南請參考：
- `TREE_VIEW_SETUP.md` - Tree View 設置
- `INTERACTION_SETUP.md` - 交互組件設置
- `AUTOMATION_SUMMARY.md` - 自動化執行總結

## 🎯 下一步

1. 完成 `LAST_MILE_CHECKLIST.md` 中的步驟
2. 參考 `FINAL_TESTING_GUIDE.md` 進行測試
3. 開始自定義開發

---

**祝開發順利！🚀**
