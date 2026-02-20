# 團隊並行開發計畫書

> **版本**：v1.0｜**日期**：2026-02-15｜**專案**：Skills SaaS + POS 模組

---

## 一、現況總盤點

### 1.1 Skills SaaS 母版完成度

經過完整的程式碼審計，目前的母版狀態如下：

| 模組 | 完成度 | 狀態 |
|------|--------|------|
| 認證系統 (Auth + Middleware) | 100% | ✅ 已完成 |
| Landing Page | 100% | ✅ 已完成 |
| 分類管理 (Category Tree + CRUD + 拖拽) | 100% | ✅ 已完成 |
| AI 分類生成 (Gemini + Streaming) | 100% | ✅ 已完成 |
| Stripe 訂閱 + Webhook | 100% | ✅ 已完成 |
| AI 配額管理 (原子操作) | 100% | ✅ 已完成 |
| Shadcn UI 元件庫 | 100% | ✅ 已完成 |
| AI 分類描述生成 | 90% | ⚠️ 缺父分類上下文 |
| 規格系統 (Specification) | 30% | ⚠️ Schema 有，API 是 Stub |
| Dashboard 側邊欄 / 多頁導航 | 10% | ⚠️ 只有頂部 Header |
| POS 模組 | 0% | ❌ 僅有計畫書 |
| 測試 | 0% | ❌ 無任何測試 |
| **整體** | **~60%** | |

### 1.2 關鍵發現

**可直接用於 POS 的既有資產：**
- `categories` 表 → 商品分類
- `profiles` 表 → 商家帳號
- Supabase Auth + RLS → 安全框架
- Zustand 狀態管理模式 → POS 購物車
- Shadcn UI 元件庫 → POS 介面
- Stripe 整合 → 未來國際支付

**兩個系統的共同缺口：**
- Dashboard 缺乏多頁面側邊欄導航
- 缺少通用的 DataTable 元件
- 缺少通知/Toast 系統
- 缺少完整的錯誤邊界處理

---

## 二、並行開發策略

### 2.1 核心思路：共享基礎層 + 雙軌業務層

```
                    ┌─────────────────────────────┐
                    │       共享基礎層 (Sprint 0)    │
                    │   Dashboard Layout / 側邊欄    │
                    │   DataTable / Toast / Error    │
                    │   DB Migration 基礎設施        │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
    ┌─────────▼─────────┐           ┌──────────▼──────────┐
    │   軌道 A：Skills    │           │   軌道 B：POS        │
    │   (補完既有功能)     │           │   (全新模組開發)      │
    │                    │           │                      │
    │  A1: 規格系統       │           │  B1: DB + 商品 CRUD   │
    │  A2: 商品管理       │           │  B2: POS 銷售介面     │
    │  A3: AI 強化       │           │  B3: 掃碼功能         │
    │  A4: 報表/分析      │           │  B4: 電子發票         │
    │                    │           │  B5: 結帳 + 金流      │
    └────────────────────┘           └──────────────────────┘
```

### 2.2 為什麼可以並行？

這兩個軌道的**檔案路徑完全不重疊**，是天然的並行切入點：

| 面向 | 軌道 A (Skills) | 軌道 B (POS) |
|------|----------------|--------------|
| 路由 | `app/dashboard/specifications/` | `app/dashboard/pos/` |
| 元件 | `components/specification/` | `components/pos/` |
| Actions | `app/actions/specifications.ts` | `app/actions/pos.ts` |
| Store | `store/useSpecStore.ts` | `store/usePosStore.ts` |
| DB 表 | `specifications`, `spec_templates` | `products`, `orders`, `invoices` |

**唯一的交集點**是 Sprint 0 的共享基礎層，必須先完成才能讓兩條軌道順利跑起來。

---

## 三、Sprint 規劃

### Sprint 0：共享基礎建設（3 天）

> **目標**：建立兩個軌道都需要的基礎設施

```
任務清單：
├── S0-1: Dashboard 側邊欄 Layout 重構
│   ├── 改造 DashboardLayout.tsx → 左側邊欄 + 頂部工具列
│   ├── 導航項目：分類管理 / 規格管理 / POS / 訂單 / 發票 / 設定
│   ├── 響應式：桌面展開、平板/手機收合為 Sheet
│   └── 預估：4hr
│
├── S0-2: 共用 UI 元件擴充
│   ├── DataTable 元件 (基於 TanStack Table + Shadcn)
│   ├── Toast/Sonner 通知系統
│   ├── 確認對話框 (ConfirmDialog)
│   ├── 空狀態 (EmptyState)
│   ├── 載入骨架 (Skeleton)
│   └── 預估：3hr
│
├── S0-3: 資料庫基礎 Migration
│   ├── 建立 products, orders, order_items, invoices 表
│   ├── 建立 specifications, spec_templates 表
│   ├── 建立 RLS 政策
│   ├── 建立 create_pos_order() RPC
│   └── 預估：3hr
│
└── S0-4: 環境與設定
    ├── 更新 .env.example（新增發票 / 金流環境變數）
    ├── 建立 lib/constants.ts（稅率、發票設定、幣別格式）
    ├── 安裝新依賴 (html5-qrcode, next-pwa, idb-keyval)
    └── 預估：1hr
```

**Sprint 0 完成標準**：
- 所有 Dashboard 子頁面可透過側邊欄互相導航
- DB Migration 可成功執行，所有 RLS 測試通過
- `npm run build` 零錯誤

---

### 軌道 A：Skills 補完（共 3 個 Sprint）

#### Sprint A1：規格系統啟動（5 天）

```
任務清單：
├── A1-1: 規格 Server Actions
│   ├── app/actions/specifications.ts
│   ├── CRUD: createSpec, updateSpec, deleteSpec, listSpecs
│   ├── Zod 驗證 (使用既有 lib/validations/spec.ts)
│   └── 預估：4hr
│
├── A1-2: 規格列表頁
│   ├── app/dashboard/specifications/page.tsx
│   ├── DataTable 顯示（標題、分類、狀態、建立日期）
│   ├── 篩選：狀態 / 分類 / 搜尋
│   └── 預估：4hr
│
├── A1-3: 規格建立/編輯頁
│   ├── app/dashboard/specifications/new/page.tsx
│   ├── app/dashboard/specifications/[id]/page.tsx
│   ├── 動態表單（根據 SpecField schema 渲染欄位）
│   ├── React Hook Form + Zod
│   └── 預估：6hr
│
├── A1-4: AI 規格生成（接通 Stub）
│   ├── 完成 app/api/specifications/ai/generate/route.ts
│   ├── 接入 Gemini AI，使用既有 prompts.ts
│   ├── 前端 AI 生成按鈕 + Streaming 顯示
│   └── 預估：4hr
│
└── A1-5: 規格模板
    ├── 系統預設模板（電子產品、食品、服飾）
    ├── 使用者自建模板
    └── 預估：3hr
```

#### Sprint A2：商品管理 + AI 強化（5 天）

```
任務清單：
├── A2-1: 商品管理頁（讀取 products 表）
│   ├── 商品列表（DataTable + 圖片縮圖）
│   ├── 商品新增 / 編輯（含圖片上傳至 Supabase Storage）
│   ├── 與 categories 表關聯
│   └── 預估：6hr
│
├── A2-2: AI 分類描述增強
│   ├── 修復 TODO：加入父分類上下文
│   ├── 支援批次生成（選多個分類一次生成）
│   └── 預估：2hr
│
├── A2-3: AI 商品描述生成
│   ├── 根據商品名稱 + 分類，AI 生成賣點描述
│   ├── 複用 AI SDK 架構
│   └── 預估：3hr
│
└── A2-4: 圖片上傳元件
    ├── components/ui/ImageUpload.tsx
    ├── 拖拽上傳 + 預覽 + 壓縮
    ├── Supabase Storage 整合
    └── 預估：4hr
```

#### Sprint A3：報表與優化（4 天）

```
任務清單：
├── A3-1: Dashboard 首頁（總覽）
│   ├── app/dashboard/page.tsx
│   ├── 統計卡片：商品數、分類數、訂單數、今日營收
│   ├── 圖表（Recharts）：近 7 日營收趨勢
│   └── 預估：5hr
│
├── A3-2: 分類列表分頁
│   ├── 大量分類時的效能優化
│   ├── 虛擬滾動 or 分頁
│   └── 預估：3hr
│
└── A3-3: 錯誤邊界 + 日誌強化
    ├── Error Boundary 元件
    ├── Sentry or LogRocket 整合（選配）
    └── 預估：2hr
```

---

### 軌道 B：POS 模組開發（共 4 個 Sprint）

#### Sprint B1：POS 基礎 + 商品 CRUD（5 天）

```
任務清單：
├── B1-1: POS 專屬 Layout
│   ├── app/dashboard/pos/layout.tsx
│   ├── 全螢幕模式（隱藏側邊欄）
│   ├── 頂部工具列：返回 Dashboard / 設定 / 全螢幕切換
│   └── 預估：3hr
│
├── B1-2: Zustand POS Store
│   ├── store/usePosStore.ts
│   ├── 購物車狀態（add, remove, updateQty, clear）
│   ├── 金額自動計算（小計、稅額 5%、折扣、總計）
│   ├── 發票資訊狀態
│   └── 預估：3hr
│
├── B1-3: 商品資料載入
│   ├── app/actions/pos.ts — fetchProducts, fetchCategories
│   ├── 支援分類篩選 + 關鍵字搜尋
│   ├── 商品快取策略 (SWR/React Query pattern)
│   └── 預估：3hr
│
├── B1-4: 商品管理頁 (POS 後台)
│   ├── app/dashboard/pos/products/page.tsx
│   ├── 複用軌道 A 的 DataTable + ImageUpload
│   ├── 條碼欄位 + 庫存欄位
│   └── 預估：4hr（若軌道 A 先完成，可直接複用，降為 2hr）
│
└── B1-5: 種子資料腳本
    ├── scripts/seed-products.ts
    ├── 20 筆範例商品（含條碼、圖片、分類）
    └── 預估：1hr
```

#### Sprint B2：POS 銷售介面（5 天）

```
任務清單：
├── B2-1: POS 主畫面
│   ├── app/dashboard/pos/page.tsx
│   ├── 左右分割佈局 (ProductGrid + CartSection)
│   ├── 響應式：桌面分割 → 平板直向上下 → 手機 Bottom Sheet
│   └── 預估：4hr
│
├── B2-2: ProductGrid + ProductCard
│   ├── components/pos/ProductGrid.tsx
│   ├── components/pos/ProductCard.tsx
│   ├── 網格佈局（auto-fill, min 120px）
│   ├── 圖片 Lazy Loading
│   ├── 庫存徽章（低庫存橘色、無庫存灰化）
│   ├── 點擊動畫（scale-95 + ring）
│   └── 預估：4hr
│
├── B2-3: CategoryTabs
│   ├── components/pos/CategoryTabs.tsx
│   ├── 橫向可滾動頁籤
│   ├── 色塊區分（從 categories.metadata 讀取顏色）
│   └── 預估：2hr
│
├── B2-4: CartSection + CartItem
│   ├── components/pos/CartSection.tsx
│   ├── components/pos/CartItem.tsx
│   ├── 數量 Stepper (- / qty / +)
│   ├── 左滑刪除（行動裝置）
│   ├── CartSummary：小計 / 稅額 / 折扣 / 總計
│   └── 預估：4hr
│
├── B2-5: SearchBar
│   ├── components/pos/SearchBar.tsx
│   ├── 即時搜尋（debounce 300ms）
│   ├── 搜尋結果高亮
│   └── 預估：2hr
│
└── B2-6: NumPad 數字鍵盤
    ├── components/pos/NumPad.tsx
    ├── 自訂數量、手動輸入金額
    └── 預估：2hr
```

#### Sprint B3：掃碼 + 結帳（5 天）

```
任務清單：
├── B3-1: 掃碼槍監聽
│   ├── lib/hooks/useBarcodeScanner.ts
│   ├── 全域 keydown 監聽
│   ├── 快速輸入偵測（< 50ms 間隔 + Enter 結尾）
│   ├── 掃到條碼 → 查詢商品 → 加入購物車
│   └── 預估：3hr
│
├── B3-2: 相機掃碼
│   ├── components/pos/BarcodeScanner.tsx
│   ├── html5-qrcode 整合
│   ├── 全螢幕掃描覆蓋層
│   ├── 前後鏡頭切換
│   ├── 支援 EAN-13, QR Code, Code 128
│   ├── 震動回饋（navigator.vibrate）
│   └── 預估：4hr
│
├── B3-3: 結帳流程
│   ├── components/pos/CheckoutDialog.tsx
│   ├── 付款方式選擇（現金 / 信用卡 / LINE Pay / 悠遊卡）
│   ├── 現金模式：輸入收款金額 → 顯示找零
│   ├── 呼叫 RPC create_pos_order()
│   └── 預估：5hr
│
├── B3-4: 訂單成功畫面
│   ├── components/pos/ReceiptPreview.tsx
│   ├── 電子收據預覽（訂單編號、明細、金額）
│   ├── 列印按鈕（預留）
│   ├── 自動 5 秒後返回銷售畫面
│   └── 預估：2hr
│
└── B3-5: 訂單歷史
    ├── app/dashboard/pos/orders/page.tsx
    ├── app/dashboard/pos/orders/[id]/page.tsx
    ├── DataTable 訂單列表
    ├── 訂單明細頁（可重印收據）
    └── 預估：4hr
```

#### Sprint B4：電子發票 + 金流（5 天）

```
任務清單：
├── B4-1: 電子發票核心模組
│   ├── lib/einvoice/ecpay.ts — 綠界 API 串接
│   ├── AES 加密 + SHA256 壓碼
│   ├── 開立 / 作廢 / 折讓 三大 API
│   └── 預估：6hr
│
├── B4-2: 發票表單元件
│   ├── components/pos/InvoiceForm.tsx
│   ├── B2C / B2B 切換
│   ├── 統編驗證（8 碼 + 檢查碼）
│   ├── 載具選擇：手機條碼 / 自然人憑證 / 會員載具
│   ├── 愛心碼捐贈
│   └── 預估：4hr
│
├── B4-3: 發票字軌管理
│   ├── app/dashboard/pos/settings/page.tsx
│   ├── 字軌配號（輸入起迄號碼）
│   ├── 自動遞增 + 用罄警告
│   └── 預估：3hr
│
├── B4-4: 發票管理頁
│   ├── app/dashboard/pos/invoices/page.tsx
│   ├── 發票列表 / 查詢 / 作廢操作
│   └── 預估：3hr
│
└── B4-5: 藍新金流串接（選配）
    ├── lib/newebpay.ts — AES + SHA256
    ├── 信用卡 / LINE Pay 支付
    ├── 回傳驗證 + 訂單狀態更新
    └── 預估：5hr
```

---

## 四、Sprint 時間軸（甘特圖）

```
Week         W1        W2        W3        W4        W5        W6
Day    1 2 3 4 5  1 2 3 4 5  1 2 3 4 5  1 2 3 4 5  1 2 3 4 5  1 2 3 4 5
       ─────────  ─────────  ─────────  ─────────  ─────────  ─────────

Sprint 0  ███░░
(共享)

軌道 A        ░░░░░  ░░░░░  ░░░░░  ░░░░
 A1 規格      ██████████
 A2 商品                    ██████████
 A3 報表                                ████████

軌道 B        ░░░░░  ░░░░░  ░░░░░  ░░░░░  ░░░░░
 B1 基礎      ██████████
 B2 銷售介面               ██████████
 B3 掃碼結帳                           ██████████
 B4 發票金流                                      ██████████

█ = 開發中    ░ = 軌道活躍期
```

### 里程碑

| 時間點 | 里程碑 | 可展示成果 |
|--------|--------|-----------|
| W1 D3 | Sprint 0 完成 | 新 Dashboard 導航可用 |
| W2 D5 | A1 + B1 完成 | 規格系統可建立；POS 有商品資料 |
| W3 D5 | A2 + B2 完成 | 商品管理可用；POS 銷售介面可操作 |
| W4 D5 | B3 完成 | **POS MVP**：可掃碼、結帳、生成訂單 |
| W5 D4 | A3 完成 | Dashboard 首頁有統計圖表 |
| W6 D5 | B4 完成 | **POS 完整版**：含電子發票 + 金流 |

---

## 五、Claude 工作模式建議

### 5.1 單人使用 Claude 的並行策略

由於你是透過 Claude 來開發，以下是最大化效率的工作模式：

#### 模式一：Sprint 交替執行（推薦）

```
每日工作節奏：

上午 Session（3hr）→ 專注軌道 A
  ├── 給 Claude 明確的任務區塊（如 A1-2: 規格列表頁）
  ├── 一次完成一個完整檔案
  └── 確認 build 通過後結束

下午 Session（3hr）→ 切換軌道 B
  ├── 給 Claude 明確的任務區塊（如 B1-2: Zustand Store）
  ├── 軌道 B 不會動到軌道 A 的檔案
  └── 確認 build 通過後結束
```

**優點**：心智負擔低、每天兩條線都有進展、可以互相啟發

#### 模式二：Sprint 串接執行

```
Sprint 0 (3天) → A1 (5天) → B1 (5天) → B2 (5天) → A2 → B3 → A3 → B4
```

**優點**：更簡單、一次只專注一件事
**缺點**：POS 產出較晚

#### 模式三：開多個 Claude Session（進階）

```
Session 1 (Cowork)：軌道 A — 規格 + 商品
Session 2 (Cowork)：軌道 B — POS 介面 + 掃碼
```

**優點**：真正並行
**注意**：需確保兩個 Session 不同時修改同一檔案（Sprint 0 先完成可避免衝突）

### 5.2 每次 Session 的最佳提示詞格式

```markdown
@Codebase
我們正在進行 [軌道 A/B] 的 [Sprint 編號] — [任務編號]

**本次任務**：[具體任務名稱]

**需要建立/修改的檔案**：
- [ ] 檔案路徑 1
- [ ] 檔案路徑 2

**依賴的已完成元件**：
- 元件 A（位於 xxx/xxx.tsx）
- Store B（位於 xxx/xxx.ts）

**驗收標準**：
1. 具體可測試的條件
2. 具體可測試的條件

請開始實作，一個檔案一個檔案完成，每完成一個請確認 build 通過。
```

---

## 六、依賴關係圖

```
Sprint 0 (共享基礎)
    │
    ├── S0-1 Dashboard Layout ──────────► 所有後續頁面都依賴
    ├── S0-2 共用 UI 元件 ──────────────► DataTable 被多處使用
    └── S0-3 DB Migration ─────┬───────► 軌道 A 需要 specifications 表
                               └───────► 軌道 B 需要 products/orders 表

軌道 A 內部依賴：
    A1 (規格系統) ──► A2 (商品管理，複用規格 schema)
    A2 (商品管理) ──► A3 (報表，需要商品數據)

軌道 B 內部依賴：
    B1 (商品 CRUD) ──► B2 (銷售介面，需要商品資料)
    B2 (銷售介面) ──► B3 (掃碼結帳，需要購物車)
    B3 (結帳) ──────► B4 (發票，結帳後開立)

跨軌道依賴（弱依賴）：
    A2 (商品管理) ◇──► B1 (POS 商品，共用 products 表)
    ↑ 共用同一張表但 UI 不同：
      A2 = 後台管理介面（DataTable + 表單）
      B1 = POS 前台商品卡片網格
```

---

## 七、風險與應對

| 風險 | 影響 | 應對策略 |
|------|------|----------|
| Sprint 0 拖延 | 兩條軌道都無法開始 | Sprint 0 限定 3 天，只做最低必要；進階 UI 可後補 |
| products 表設計兩軌不一致 | 資料衝突 | Sprint 0 統一定義，兩軌共用同一份 Migration |
| 電子發票 API 串接困難 | B4 延期 | 先做 Mock，確認 UI 流程；API 串接可獨立 Debug |
| 藍新金流測試環境不穩 | B4 延期 | 先完成現金結帳路徑，金流作為可選模組 |
| Claude Context 過長 | 回應品質下降 | 每個任務獨立 Session、提供精確檔案路徑 |

---

## 八、立即可執行的下一步

### 推薦順序：

```
Step 1 → 確認本計畫（你現在在這裡）
Step 2 → 執行 Sprint 0（我現在就可以開始）
Step 3 → 你選擇用哪種工作模式（交替 / 串接 / 多 Session）
Step 4 → 開始第一輪 A1 + B1
```

### Sprint 0 的第一個任務（可立即開始）：

```
S0-1: Dashboard 側邊欄 Layout 重構
  - 改造 components/layout/DashboardLayout.tsx
  - 新增側邊欄導航：分類 / 規格 / POS / 訂單 / 設定
  - 響應式收合
```

---

> **請告訴我：**
> 1. 你偏好哪種工作模式？（交替 / 串接 / 多 Session）
> 2. 要我現在就開始 Sprint 0 嗎？
