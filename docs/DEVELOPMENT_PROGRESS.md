# Skills SaaS 開發進度報告

> 最後更新：依目前專案狀態整理

---

## 一、專案概覽

| 項目 | 說明 |
|------|------|
| **專案名稱** | Skills SaaS - 智能商務平台 |
| **正式環境** | https://skills-saas-fkpc.vercel.app |
| **技術棧** | Next.js 14 (App Router)、Supabase、Stripe、Tailwind + Shadcn UI、Zustand、React Hook Form + Zod |
| **Repo** | weimodesigntw-star/skills-saas (main) |

---

## 二、已完成模組

### 2.1 基礎建設

| 項目 | 狀態 | 說明 |
|------|------|------|
| 認證 (Auth + Middleware) | ✅ 100% | 登入/登出、Supabase Auth、protected routes |
| Landing Page | ✅ 100% | 首頁、方案說明、登入/註冊入口 |
| Dashboard Layout + Sidebar | ✅ 100% | 左側導航（總覽、分類管理、POS、商品、規格、報表）、收合展開 |
| 共用 UI 元件 | ✅ 100% | Toast、Sheet、Tooltip、Button、Card、Dialog、Form、ImageUpload、EmptyState、Skeleton、ConfirmDialog 等 |
| 錯誤邊界 | ✅ | app/error.tsx、app/global-error.tsx |

### 2.2 分類管理 (Categories)

| 功能 | 狀態 |
|------|------|
| 無限層級分類樹 | ✅ |
| 拖拽排序（Fractional Indexing） | ✅ |
| CRUD（新增/編輯/刪除） | ✅ |
| 分類搜尋 + 高亮 + 自動展開 | ✅ |
| AI 分類描述生成 (Gemini) | ✅ |
| AI 分類樹生成（主題一鍵生成） | ✅ |

### 2.3 訂閱與金流 (Stripe)

| 功能 | 狀態 |
|------|------|
| Stripe Checkout（升級 Pro） | ✅ |
| Stripe Customer Portal（管理訂閱） | ✅ |
| Webhook（訂閱建立/更新/取消 → 更新 profiles.tier） | ✅ |
| 方案 UI（Free / Pro、UpgradeButton） | ✅ |
| Webhook 正式環境設定文件 | ✅ docs/STRIPE_WEBHOOK_VERCEL.md |

### 2.4 AI 與配額

| 功能 | 狀態 |
|------|------|
| AI 配額（原子操作、每日上限） | ✅ migration 006_atomic_ai_quota.sql |
| 分類描述 AI 生成 (Gemini) | ✅ |
| 規格 AI 生成 API | ✅ app/api/specifications/ai/generate（可接 Gemini） |

### 2.5 POS 模組（P0-2 / P0-3 / P0-4 已完成）

| 功能 | 狀態 |
|------|------|
| POS 全螢幕 Layout（頂部返回/設定） | ✅ |
| 購物車 Store (usePosStore) | ✅ |
| POS 主畫面（商品區 + 購物車、Sheet 行動版） | ✅ |
| 分類頁籤、搜尋列、商品網格、購物車區、結帳 Dialog | ✅ |
| 條碼掃描（鍵盤輸入 + BarcodeScanner 元件） | ✅ |
| 結帳流程（付款方式、發票資訊、收據預覽） | ✅ |
| POS Server Actions（商品/分類/訂單） | ✅ |
| 訂單列表、訂單詳情、庫存、發票、字軌設定頁 | ✅ 完整 CRUD / 篩選分頁 / 開立作廢重印 / 字軌流程 |
| RPC create_pos_order（防超賣） | ✅ migration 009 |

### 2.6 商品與規格

| 功能 | 狀態 |
|------|------|
| 商品列表 / 新增 / 編輯（含圖片上傳） | ✅ |
| 規格列表 / 新增 / 編輯 | ✅ |
| 規格 AI 生成 API | ✅ |

### 2.7 資料庫 Migrations

| 檔案 | 用途 |
|------|------|
| 001 ~ 005 | 分類、RLS、profiles、quota |
| 006 | AI 配額原子操作 |
| 007 | 分類 sort_order 改 double precision |
| 008 | POS / 規格相關表 |
| 009 | create_pos_order RPC |
| 010 | 缺失表修正 |
| 011 ~ 015 | news、gallery、videos、profiles 增強、購物車等 |
| 016 | 字軌 unique constraint + RPC |
| 017 | orders.invoice_number 欄位 |
| 018 | stock_adjustments 表 |
| 019 | adjust_stock RPC |
| 020 | Dashboard RPCs（get_daily_revenue、get_top_products） |
| 021 | invoices ECPay 欄位（ecpay_invoice_number、ecpay_random_number） |
| 022 | members 表（顧客會員 CRUD） |
| 023 | create_pos_order 擴充顧客欄位（customer_name、customer_phone） |
| 024 | orders.member_id（選做，消費紀錄用） |

### 2.8 P2 對外商店與會員

| 功能 | 狀態 |
|------|------|
| 對外商店 `/shop`、`/shop/[id]` | ✅ 商品列表、分類/搜尋篩選、庫存 0 顯示「已售完」 |
| 購物車 `/cart`、結帳 `/checkout` | ✅ Guest Cart（localStorage）+ 登入合併、結帳表單（Zod）、create_pos_order RPC |
| 會員管理 `/dashboard/members` | ✅ CRUD、搜尋、分頁、詳情頁、消費紀錄（需 024） |
| ECPay 電子發票 | ✅ 開立/作廢串接（lib/ecpay/invoice.ts），環境變數設定即可用 |

---

## 三、待補 / 選做

| 項目 | 狀態 | 備註 |
|------|------|------|
| B-2 商品規格選擇 UI | 🔵 待 schema | 需先補 `specifications` 與 `products` 關聯（如 product_id 或 product_specs 表），再於 `/shop/[id]` 加規格選項與加入購物車邏輯 |
| orders.member_id（024） | 🔵 選做 | 未跑時會員詳情頁消費紀錄顯示「尚無消費紀錄」（已有 try/catch） |

---

## 四、其他路由（依專案檔案）

以下路由在專案中有對應 page，實際完成度以各檔案為準：

- **對外**：`/`、`/login`、`/terms`、`/privacy`、`/news`、`/news/[id]`、`/videos`、`/videos/[id]`、`/shop`、`/shop/[id]`、`/cart`、`/checkout`
- **Dashboard**：`/dashboard`、`/dashboard/categories`、`/dashboard/pos/*`、`/dashboard/products/*`、`/dashboard/specifications/*`、`/dashboard/reports`、`/dashboard/news/*`、`/dashboard/videos/*`、`/dashboard/galleries/*`、`/dashboard/members/*`

---

## 五、部署與維運

| 項目 | 狀態 |
|------|------|
| Vercel 部署 | ✅ 正式環境可訪問 |
| 環境變數 | 需在 Vercel 設定 Stripe、Supabase、AI、NEXT_PUBLIC_APP_URL 等（見 docs/STRIPE_WEBHOOK_VERCEL.md） |
| Stripe Webhook | 需在 Stripe Dashboard 將 endpoint 設為正式網址並更新 STRIPE_WEBHOOK_SECRET |

---

## 六、參考文件

- `README.md` — 快速開始與核心功能
- `TRACK_A_SKILLS.md` — 軌道 A（規格/商品/報表）任務書
- `TRACK_B_POS.md` — 軌道 B（POS）任務書
- `PARALLEL_DEV_PLAN.md` — 並行開發計畫與 Sprint 規劃
- `docs/STRIPE_WEBHOOK_VERCEL.md` — Stripe Webhook 正式環境設定
- `_specs/02_schema.md` — 資料庫 Schema 說明

---

## 七、整體完成度概估

| 階段 | 任務數 | 狀態 | 完成度 |
|------|--------|------|--------|
| P0 基礎 + POS 核心流程 | 4 | ✅ 全完成 | 100% |
| P1 規格 / AI / Dashboard / 庫存 | 5 | ✅ 全完成 | 100% |
| P2 ECPay / 商店 / 會員 | 3 | ✅ 全完成 | 100% |
| B-2 商品規格選擇 UI | 1 | 🔵 待 schema | 待補 |

| 區塊 | 完成度 |
|------|--------|
| 認證、Landing、Layout、共用 UI | 100% |
| 分類管理 + AI 分類（含父分類上下文） | 100% |
| Stripe 訂閱 + Webhook | 100% |
| POS 銷售流程（主畫面、購物車、結帳、字軌、發票） | 100% |
| 商品 / 規格 CRUD、規格 AI 生成 | 100% |
| Dashboard 總覽（圖表、指標卡、低庫存） | 100% |
| 對外商店、Guest Cart、結帳 RPC | 100% |
| 會員管理 CRUD、ECPay 發票串接 | 100% |
| **整體** | **約 97%**（剩 B-2 需 schema 後補） |

### 待執行 Migrations 清單（請確認都有跑）

| Migration | 用途 | 必要性 |
|-----------|------|--------|
| 016 | 字軌 unique constraint + RPC | ✅ 必要 |
| 017 | orders.invoice_number 欄位 | ✅ 必要 |
| 018 | stock_adjustments 表 | ✅ 必要 |
| 019 | adjust_stock RPC | ✅ 必要 |
| 020 | Dashboard RPCs | ✅ 必要 |
| 021 | invoices ECPay 欄位 | ✅ 必要 |
| 022 | members 表 | ✅ 必要 |
| 023 | create_pos_order 擴充顧客欄位 | ✅ 必要 |
| 024 | orders.member_id | 🔵 選做 |
