# 軌道 A：Skills 補完任務書

> **本文件供獨立的 Cowork Session 使用**
> 複製以下內容作為 Session 的啟動提示詞

---

## 專案上下文

你正在開發一個 SaaS 平台 (Next.js 14 + Supabase + Shadcn UI)。
Sprint 0（共享基礎建設）已完成，包含：

- ✅ Dashboard 側邊欄 Layout (`components/layout/Sidebar.tsx` + `app/dashboard/layout.tsx`)
- ✅ 共用元件：Toast, EmptyState, Skeleton, ConfirmDialog, Sheet, Separator, Tooltip
- ✅ DB Migration：products, orders, invoices, specifications, spec_templates 表
- ✅ 常數檔 `lib/constants.ts`（稅率、幣別、發票）

## 你的任務：軌道 A — Skills 功能補完

### Sprint A1：規格系統（優先）

**你只能修改以下路徑的檔案，不要動 `components/pos/` 或 `app/dashboard/pos/`：**

1. **A1-1**: `app/actions/specifications.ts`
   - CRUD Server Actions: createSpec, updateSpec, deleteSpec, listSpecs
   - 使用 `lib/validations/spec.ts` 的 Zod Schema
   - 使用 `lib/supabase/server.ts` 連接資料庫

2. **A1-2**: `app/dashboard/specifications/page.tsx`
   - 規格列表頁（使用 DataTable 或手工表格）
   - 篩選：狀態 / 分類 / 搜尋

3. **A1-3**: `app/dashboard/specifications/new/page.tsx` + `[id]/page.tsx`
   - 規格建立/編輯頁
   - 動態表單渲染（根據 SpecField 類型）
   - React Hook Form + Zod

4. **A1-4**: 接通 `app/api/specifications/ai/generate/route.ts`
   - 目前是 Stub（return 501）
   - 接入 Gemini AI，使用 `lib/ai/prompts.ts` 的系統提示詞
   - 前端 AI 生成按鈕 + Streaming

### Sprint A2：商品管理 + AI 強化

1. `app/dashboard/products/page.tsx` — 商品列表
2. `app/dashboard/products/new/page.tsx` — 商品新增（含圖片上傳到 Supabase Storage）
3. 修復 `components/category/EditCategoryDialog.tsx` 的 TODO（父分類上下文）
4. `components/ui/image-upload.tsx` — 拖拽圖片上傳元件

### Sprint A3：Dashboard 首頁 + 報表

1. 更新 `app/dashboard/page.tsx` — 接入真實數據（商品數、訂單數等）
2. 圖表元件（使用 Recharts）

## 驗收標準

每完成一個檔案，執行 `npx tsc --noEmit` 確認零錯誤。
