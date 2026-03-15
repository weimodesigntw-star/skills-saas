# 🦞 Skills SaaS — 開發交接文件

> **交接對象**：小龍蝦團隊（承接後續開發）  
> **專案**：Skills SaaS 智能商務平台  
> **正式環境**：https://skills-saas-fkpc.vercel.app  
> **Repo**：`weimodesigntw-star/skills-saas`（branch: `main`）

---

## 一、環境建置與 .env 說明

### 本地啟動步驟

```bash
git clone https://github.com/weimodesigntw-star/skills-saas.git
cd skills-saas
npm install
cp .env.example .env.local   # 填入下方變數
npm run dev
```

### 必要環境變數

| 變數名稱 | 說明 | 取得位置 |
|----------|------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | Supabase Dashboard → Project Settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公開金鑰 | 同上 |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side 專用（勿暴露） | 同上 |
| `STRIPE_SECRET_KEY` | Stripe 後端金鑰 | Stripe Dashboard → Developers |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 前端金鑰 | 同上 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 驗證金鑰 | Stripe Dashboard → Webhooks |
| `STRIPE_PRO_PRICE_ID` | Pro 方案的 Price ID | Stripe → Products |
| `GEMINI_API_KEY` | Google Gemini AI 金鑰 | Google AI Studio |
| `NEXT_PUBLIC_APP_URL` | 正式域名（Webhook 用） | 例：`https://skills-saas-fkpc.vercel.app` |
| `ECPAY_MERCHANT_ID` *(選填)* | ECPay 電子發票商店代號 | ECPay 後台 |
| `ECPAY_HASH_KEY` *(選填)* | ECPay HashKey | 同上 |
| `ECPAY_HASH_IV` *(選填)* | ECPay HashIV | 同上 |

> ⚠️ Stripe Webhook：本地開發需使用 `stripe listen --forward-to localhost:3000/api/webhooks/stripe`，正式環境請參照 `docs/STRIPE_WEBHOOK_VERCEL.md`

### 資料庫 Migration

Supabase 已有 `001～024` migration 檔，請確認以下皆已執行（尤其是 016～023）：

| Migration | 用途 | 必要性 |
|-----------|------|--------|
| 016 | 字軌 unique constraint + RPC | ✅ 必要 |
| 017 | orders.invoice_number 欄位 | ✅ 必要 |
| 018 | stock_adjustments 表 | ✅ 必要 |
| 019 | adjust_stock RPC | ✅ 必要 |
| 020 | Dashboard RPCs（get_daily_revenue、get_top_products） | ✅ 必要 |
| 021 | invoices ECPay 欄位 | ✅ 必要 |
| 022 | members 表（顧客會員） | ✅ 必要 |
| 023 | create_pos_order 擴充顧客欄位 | ✅ 必要 |
| 024 | orders.member_id（消費紀錄用） | 🔵 選做 |

```bash
npx supabase db push   # 或在 Supabase Dashboard 手動執行 SQL
```

---

## 二、專案進度總結（P0 / P1 / P2 全完成）

### ✅ P0 — 基礎 + POS 核心流程（100%）

| # | 任務 | 狀態 |
|---|------|------|
| 1 | Stripe Webhook 正式環境驗證 | ✅ |
| 2 | POS 訂單列表、發票、字軌 | ✅ |

### ✅ P1 — 規格 / AI / Dashboard / 庫存（100%）

| # | 任務 | 狀態 |
|---|------|------|
| 5 | 規格系統補完 + AI 串接 | ✅ |
| 6 | AI 分類描述補父分類上下文 | ✅ |
| 7 | Dashboard 總覽圖表與指標 | ✅ |
| 8 | 庫存頁面完整功能 | ✅ |
| — | AI 配額顯示（規格/分類按鈕旁） | ✅ |

### ✅ P2 — ECPay / 商店 / 會員（100%）

| # | 任務 | 狀態 |
|---|------|------|
| 9 | ECPay 電子發票串接 | ✅ |
| 10 | 對外商店流程驗證 + 修補（Guest Cart、結帳表單、RPC） | ✅ |
| 11 | 會員管理 CRUD | ✅ |

**P2-3 實作細節（交接用）：**

- 會員相關 Server Actions 檔名為 **`app/actions/customer-members.ts`**（非 `members.ts`），避免與原「團隊成員」profiles 邏輯衝突。
- **Migration 024**（`orders.member_id`）為選做；未跑時會員詳情頁已有 try/catch 保護，消費紀錄區顯示「尚無消費紀錄」。

### 🔵 待補

| 項目 | 說明 |
|------|------|
| B-2 商品規格選擇 UI | 需先補 `specifications` 與 `products` 關聯 schema，再於 `/shop/[id]` 加規格選項與加入購物車邏輯。 |

**整體完成度約 97%**

---

## 三、各模組開發規範與注意事項

### 📁 專案結構慣例

```
app/
  (auth)/          # 登入、註冊頁
  (dashboard)/     # 所有需認證的後台頁面
  api/             # Route Handlers（Stripe webhook、AI API 等）
components/
  ui/              # Shadcn 共用元件，勿隨意改動
  [feature]/       # 各功能元件，以功能分資料夾
lib/
  supabase/        # server / client / middleware helper
  stripe/          # Stripe 初始化與工具
stores/            # Zustand stores（如 usePosStore）
```

### 🛠 開發規範

- **Server Actions 優先**：資料操作盡量使用 `use server` Server Actions，避免直接在 Client Component 呼叫 Supabase
- **型別安全**：所有 Supabase 查詢結果請搭配 `Database` 型別（`lib/supabase/types.ts`）
- **表單驗證**：統一使用 `React Hook Form + Zod`，schema 定義在各功能資料夾的 `schema.ts`
- **錯誤處理**：API Route 回傳統一用 `{ error: string }` / `{ data: T }`，頁面層用 `app/error.tsx`
- **AI 配額**：每次呼叫 AI 前必須先執行 `consumeAiQuota()`（migration 006），不可繞過

### ⚠️ 高風險區域

| 區域 | 風險說明 |
|------|-----------|
| `create_pos_order` RPC | 防超賣邏輯在 DB 層（migration 009），前端勿自行扣庫存 |
| `profiles.tier` 欄位 | 只能由 Stripe Webhook 更新，前端不可直接寫入 |
| Supabase RLS | 所有表都有 Row Level Security，新增表必須同步設定 policy |
| AI quota | `daily_quota` 為原子操作，修改需注意 race condition |

---

## 四、資料庫 Schema 與 RLS 說明

### 核心資料表

| 資料表 | 用途 | 關鍵欄位 |
|--------|------|-----------|
| `profiles` | 使用者方案資訊 | `id`（= auth.uid）、`tier`（free/pro）、`ai_quota_used`、`ai_quota_reset_at` |
| `categories` | 無限層級分類 | `id`、`parent_id`、`name`、`sort_order`（double precision，fractional indexing）|
| `products` | 商品資料 | `id`、`category_id`、`name`、`price`、`stock`、`barcode`、`image_url` |
| `specifications` | 商品規格 | `id`、`product_id`、`name`、`options`（jsonb） |
| `orders` | 訂單主檔 | `id`、`user_id`、`order_number`、`total_amount`、`status`、`invoice_number`、`member_id`（選做） |
| `order_items` | 訂單明細 | `order_id`、`product_id`、`quantity`、`unit_price`、`subtotal` |
| `members` | 顧客會員（P2-3） | `id`、`user_id`、`name`、`phone`、`email`、`total_spent`、`visit_count` |
| `invoice_sequences` / 字軌 | 電子發票字軌 | 見 migration 016 |

### RLS 政策原則

- 所有後台資料表：`auth.uid() = user_id`（使用者只能讀寫自己的資料）
- `profiles` 表：使用者只能讀取與更新自己的 row，`tier` 欄位僅 service role 可寫
- 新增資料表時，請參照現有 migration 中的 `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` 範本

### 重要 RPC

| RPC 名稱 | 說明 |
|----------|------|
| `create_pos_order` | 原子性建立訂單並扣庫存（migration 009），防止超賣 |
| `consume_ai_quota` / `check_and_increment_ai_usage` | 原子性消耗 AI 配額（migration 006） |
| `create_pos_order` | 原子性建立訂單並扣庫存（migration 009/023），支援顧客姓名、電話 |
| `get_daily_revenue`、`get_top_products` | Dashboard 圖表用（migration 020） |

> 完整 Schema 請參閱 `_specs/02_schema.md`

---

## 五、快速聯絡與參考資源

| 資源 | 路徑 |
|------|------|
| Stripe Webhook 設定 | `docs/STRIPE_WEBHOOK_VERCEL.md` |
| **P0-1 正式環境驗證逐步清單** | `docs/P01_STRIPE_WEBHOOK_VERIFICATION.md` |
| **P1 全部規格（四項）** | `docs/P1_SPECS_FULL.md` |
| 軌道 A（規格/商品/報表）任務書 | `TRACK_A_SKILLS.md` |
| 軌道 B（POS）任務書 | `TRACK_B_POS.md` |
| 並行開發計畫 | `PARALLEL_DEV_PLAN.md` |
| 開發進度報告 | `docs/DEVELOPMENT_PROGRESS.md` |

---

**本專案自本文件起由小龍蝦團隊承接開發，請依上述環境、任務清單與規範進行後續開發。**

---

**全專案進度詳見** `docs/DEVELOPMENT_PROGRESS.md`（含 P0/P1/P2 完成度、待執行 migrations 016～024、整體約 97%）。 🙌
