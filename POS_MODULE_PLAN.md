# POS 模組計畫書

> **版本**：v1.0｜**日期**：2026-02-15｜**架構基底**：Skills SaaS (Next.js 14 + Supabase + Shadcn UI)

---

## 一、計畫總覽

### 1.1 目標

在現有的 Skills SaaS 母版上，新增一套完整的 **POS（銷售時點情報系統）模組**，具備以下核心能力：

- 觸控友善的銷售介面（平板 / 手機 / 桌面）
- 手機與平板即時掃碼（相機掃碼 + 實體掃碼槍）
- 台灣電子發票開立（B2C 存證發票，符合 MIG 4.1 規格）
- 庫存即時扣減與訂單管理
- 離線容錯與斷線續傳

### 1.2 業界標竿分析

本計畫參考了 2025–2026 年全球頂尖 POS 系統的設計理念：

| 標竿系統 | 借鑒重點 |
|----------|----------|
| **Square POS** | 極簡觸控 UI、最少點擊次數完成結帳、色塊化商品分類 |
| **Toast POS** | 餐飲場景的 Open View / Focus View 雙模式、廚房工單流 |
| **Lightspeed** | Grid / List 切換、深色模式、高品質商品圖片佈局 |
| **ConnectPOS** | PWA 架構、跨裝置同步、QR Code 支付整合 |
| **KORONA POS** | 1D + 2D 全條碼支援、零售場景庫存預警 |

### 1.3 設計原則

1. **KISS 原則**：消除多餘的認知負擔，每個動作不超過 3 次點擊
2. **Mobile-First**：以 iPad (1024×768) 為主要設計基準，向上適配桌面、向下適配手機
3. **模組化**：POS 作為獨立模組掛載於 `/dashboard/pos`，不影響母版其他功能
4. **離線優先**：使用 Service Worker + IndexedDB 確保斷網仍可結帳
5. **台灣在地化**：電子發票、載具、統編、新台幣格式全面支援

---

## 二、系統架構

### 2.1 技術棧總覽

```
┌─────────────────────────────────────────────────────┐
│                    前端 (Client)                      │
│  Next.js 14 (App Router) + Shadcn UI + Tailwind CSS  │
│  Zustand (購物車狀態) + React Hook Form + Zod         │
│  html5-qrcode (相機掃碼) + PWA (Service Worker)       │
├─────────────────────────────────────────────────────┤
│                  API 層 (Server)                      │
│  Next.js Server Actions / Route Handlers              │
│  電子發票加密模組 (AES + SHA256)                       │
├─────────────────────────────────────────────────────┤
│                  資料層 (Database)                     │
│  Supabase (PostgreSQL + Auth + RLS + Realtime)        │
│  Database Functions (RPC) — 交易安全                    │
├─────────────────────────────────────────────────────┤
│                  外部服務                              │
│  電子發票加值中心 API (綠界 / 鯨躍)                     │
│  藍新金流 NewebPay (信用卡 / LINE Pay)                 │
└─────────────────────────────────────────────────────┘
```

### 2.2 路由結構

```
app/dashboard/pos/
├── page.tsx                    # POS 主畫面（銷售模式）
├── layout.tsx                  # POS 專屬全螢幕 Layout（隱藏側邊欄）
├── orders/
│   ├── page.tsx                # 訂單歷史列表
│   └── [id]/page.tsx           # 訂單明細 / 重印發票
├── products/
│   └── page.tsx                # 商品管理 (CRUD)
├── inventory/
│   └── page.tsx                # 庫存管理 / 進貨
├── invoices/
│   └── page.tsx                # 電子發票管理 / 作廢 / 折讓
└── settings/
    └── page.tsx                # POS 設定（發票設定、收銀機設定）
```

### 2.3 元件架構

```
components/pos/
├── PosLayout.tsx               # 全螢幕橫式佈局容器
├── ProductGrid.tsx             # 商品網格（左側 65%）
├── ProductCard.tsx             # 單一商品卡片
├── CategoryTabs.tsx            # 分類頁籤（橫向滾動）
├── SearchBar.tsx               # 搜尋 + 條碼輸入
├── BarcodeScanner.tsx          # 相機掃碼元件
├── CartSection.tsx             # 購物車區（右側 35%）
├── CartItem.tsx                # 購物車明細項
├── CartSummary.tsx             # 小計 / 稅額 / 總計
├── CheckoutDialog.tsx          # 結帳彈窗（付款方式選擇）
├── PaymentMethods.tsx          # 付款方式元件
├── InvoiceForm.tsx             # 發票資訊表單（統編 / 載具）
├── ReceiptPreview.tsx          # 電子收據預覽
├── NumPad.tsx                  # 數字鍵盤（自訂數量 / 金額）
└── OfflineIndicator.tsx        # 離線狀態提示
```

---

## 三、POS 主畫面 UI 設計規範

### 3.1 佈局 (Layout)

```
┌──────────────────────────────────────────────────────────┐
│ [分類頁籤: 全部 | 茶葉 | 茶具 | 禮盒 | ...]    [掃碼] [設定] │
├────────────────────────────────┬─────────────────────────┤
│                                │                         │
│        商品網格 (65%)           │     購物車 (35%)         │
│                                │                         │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  ┌─────────────────┐   │
│  │ 商品A │ │ 商品B │ │ 商品C │   │  │ 烏龍茶 x2  $600 │   │
│  │ $300  │ │ $450  │ │ $200  │   │  │ 茶壺   x1  $1200│   │
│  └──────┘ └──────┘ └──────┘   │  │ ─────────────── │   │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  │ 小計     $1,800  │   │
│  │ 商品D │ │ 商品E │ │ 商品F │   │  │ 稅額       $90  │   │
│  │ $180  │ │ $550  │ │ $800  │   │  │ 總計     $1,890  │   │
│  └──────┘ └──────┘ └──────┘   │  │                 │   │
│                                │  │ [───── 結帳 ─────] │   │
│  [🔍 搜尋商品或掃描條碼...]      │  │ [暫存] [清空] [折扣] │   │
│                                │                         │
└────────────────────────────────┴─────────────────────────┘
```

### 3.2 設計細節

**商品卡片 (ProductCard)**
- 尺寸：最小觸控區域 `min-h-[120px] min-w-[120px]`
- 內容：商品圖（Lazy Loading）、名稱（最多 2 行）、價格（粗體醒目）
- 庫存警示：庫存 < 5 時顯示橘色徽章，庫存 = 0 灰化並禁止點擊
- 點擊回饋：`scale-95` + `ring-2 ring-primary` 動畫，200ms 過渡

**購物車區 (CartSection)**
- 固定高度，內容可滾動
- 每項顯示：商品名稱、單價、數量增減 Stepper（- / 數量 / +）、小計
- 左滑刪除（行動裝置）或 hover 顯示刪除按鈕（桌面）
- 結帳按鈕：`h-16` 大尺寸、綠色主色、圓角、帶金額顯示

**分類頁籤 (CategoryTabs)**
- 橫向可滾動，使用現有 categories 表的資料
- 色塊區分（參考 Square 的設計語言）
- 支援「全部」預設頁籤

### 3.3 響應式斷點

| 裝置 | 斷點 | 佈局策略 |
|------|------|----------|
| 桌面 | >= 1280px | 左 65% / 右 35%，商品 4-5 欄 |
| 平板橫向 | 1024-1279px | 左 60% / 右 40%，商品 3-4 欄 |
| 平板直向 | 768-1023px | 上下佈局：上方商品、下方購物車（可摺疊） |
| 手機 | < 768px | 全螢幕商品，購物車以 Bottom Sheet 呈現 |

---

## 四、掃碼功能設計

### 4.1 雙模式掃碼架構

```
掃碼方式
├── 模式 A：實體掃碼槍（USB / Bluetooth）
│   └── 原理：掃碼槍模擬鍵盤輸入，監聽全域 keydown 事件
│   └── 技術：react-hotkeys-hook 或自訂 useBarcodeScannerHook
│   └── 觸發：連續快速輸入 + Enter 鍵結尾
│
└── 模式 B：手機/平板相機掃碼
    └── 原理：調用 MediaDevices API，透過相機即時辨識
    └── 技術：html5-qrcode（支援 1D EAN/UPC + 2D QR Code）
    └── UI：點擊掃碼按鈕 → 開啟全螢幕相機覆蓋層
```

### 4.2 掃碼辨識支援格式

| 格式 | 類型 | 用途 |
|------|------|------|
| EAN-13 | 1D | 台灣常見商品條碼 |
| EAN-8 | 1D | 小型商品 |
| Code 128 | 1D | 內部管理條碼 |
| QR Code | 2D | 行動支付、會員卡、電子發票載具 |
| Code 39 | 1D | 物流 / 倉儲 |

### 4.3 掃碼流程

```
使用者掃碼
    │
    ▼
解析條碼字串
    │
    ├─ 匹配 products.barcode → 加入購物車（Optimistic UI 立即反應）
    │
    ├─ 匹配載具條碼格式 → 自動帶入發票載具欄位
    │
    └─ 無匹配 → 顯示 Toast 提示「查無此商品」+ 震動回饋
```

### 4.4 技術選型：html5-qrcode

選擇理由：
- 同時支援 1D（EAN、Code128）與 2D（QR Code）條碼
- 內建 UI 掃碼框，開發成本低
- 活躍維護中（2025 年仍有更新）
- 純前端，不需後端服務
- 支援前後鏡頭切換（手機場景關鍵）

```bash
npm install html5-qrcode
```

---

## 五、台灣電子發票整合

### 5.1 規格遵循

- **MIG 版本**：4.1（2025 年 1 月 1 日正式實施）
- **舊版停用**：MIG 3.x / 4.0 於 2026 年 1 月 1 日停止使用
- **發票類型**：B2C 存證發票（消費者無統編）+ B2B 發票（有統編）
- **上傳時限**：48 小時內上傳至財政部平台

### 5.2 串接架構

```
POS 結帳完成
    │
    ▼
Server Action: createInvoice()
    │
    ├── 組裝 MIG 4.1 XML 格式資料
    │     ├── InvoiceNumber (發票號碼，由字軌 + 號碼組成)
    │     ├── InvoiceDate (開立日期)
    │     ├── BuyerIdentifier (統編，B2C 填 0000000000)
    │     ├── CarrierType (載具類別)
    │     ├── CarrierId1 / CarrierId2 (載具編號)
    │     ├── DonateMark (捐贈碼)
    │     └── InvoiceItem[] (品項明細)
    │
    ▼
呼叫加值中心 API
    │
    ├── 方案 A：綠界 ECPay 電子發票 API
    │     ├── POST /Invoice/Issue (開立發票)
    │     ├── POST /Invoice/IssueInvalid (作廢發票)
    │     └── POST /Invoice/Allowance (折讓)
    │
    └── 方案 B：自建 Turnkey + 財政部平台
          └── 產出 XML → 放入 Turnkey 上傳目錄 → 自動上傳
    │
    ▼
回寫 invoices 表 (invoice_number, status, carrier_type...)
```

### 5.3 加值中心選型建議

| 項目 | 綠界 ECPay (推薦) | 鯨躍 CetusTek | 自建 Turnkey |
|------|-------------------|---------------|-------------|
| 導入難度 | 低（RESTful API） | 中 | 高（需安裝 Java） |
| 月費 | 依開立張數計費 | 依方案 | 免費（但需維運） |
| 適合對象 | 中小企業 / 新創 | 中大企業 | 技術團隊充足 |
| SDK | Node.js SDK 可用 | API 文件 | 無官方 SDK |
| MIG 4.1 | 已支援 | 已支援 | 需自行實作 |

### 5.4 發票相關 UI

**結帳時的發票表單 (InvoiceForm)**：
- 發票類型切換：二聯式（B2C）/ 三聯式（B2B）
- B2B 欄位：統一編號（8 碼驗證）、公司抬頭
- 載具選擇：手機條碼 / 自然人憑證 / 會員載具
- 捐贈：愛心碼輸入（3-7 碼數字）
- 預設行為：未指定載具或捐贈時，存入會員載具（或列印）

---

## 六、資料庫設計

### 6.1 新增資料表

```sql
-- ========================================
-- 1. products (商品表)
-- ========================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,
  barcode TEXT,                          -- 條碼（EAN-13 等）
  sku TEXT,                              -- 內部貨號
  price DECIMAL(10,2) NOT NULL,          -- 售價（含稅）
  cost DECIMAL(10,2),                    -- 成本價
  stock INTEGER NOT NULL DEFAULT 0,      -- 庫存數量
  low_stock_threshold INTEGER DEFAULT 5, -- 低庫存警示門檻
  image_url TEXT,                        -- 商品圖片
  is_active BOOLEAN DEFAULT TRUE,        -- 是否上架

  tax_type TEXT DEFAULT 'taxable',       -- taxable / tax_free / zero_rate
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE UNIQUE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name_search ON products USING GIN(to_tsvector('simple', name));

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own products"
  ON products FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 2. orders (訂單表)
-- ========================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  order_number TEXT NOT NULL,            -- 訂單編號（POS-20260215-001）
  status TEXT NOT NULL DEFAULT 'pending', -- pending / paid / refunded / voided
  payment_method TEXT,                    -- cash / credit_card / line_pay / easy_card
  payment_reference TEXT,                 -- 金流交易序號

  subtotal DECIMAL(10,2) NOT NULL,       -- 小計（稅前）
  tax_amount DECIMAL(10,2) DEFAULT 0,    -- 稅額
  discount_amount DECIMAL(10,2) DEFAULT 0, -- 折扣金額
  total_amount DECIMAL(10,2) NOT NULL,   -- 總計（實收）

  customer_name TEXT,                    -- 顧客名稱（選填）
  customer_phone TEXT,                   -- 顧客電話（選填）
  note TEXT,                             -- 訂單備註

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own orders"
  ON orders FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 3. order_items (訂單明細表)
-- ========================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,

  product_name TEXT NOT NULL,            -- 快照：商品名稱
  product_barcode TEXT,                  -- 快照：條碼
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,     -- 快照：單價
  subtotal DECIMAL(10,2) NOT NULL,       -- 該項小計

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- ========================================
-- 4. invoices (電子發票表)
-- ========================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 發票資訊
  invoice_number TEXT NOT NULL,           -- 發票號碼（AB-12345678）
  invoice_date DATE NOT NULL,             -- 開立日期
  invoice_type TEXT NOT NULL DEFAULT 'B2C', -- B2C / B2B

  -- 買方資訊
  buyer_identifier TEXT DEFAULT '0000000000', -- 統編（B2C 填 10 個 0）
  buyer_name TEXT,                        -- 買方名稱

  -- 載具 & 捐贈
  carrier_type TEXT,                      -- 手機條碼 / 自然人憑證 / 會員載具
  carrier_id TEXT,                        -- 載具編號
  donate_mark BOOLEAN DEFAULT FALSE,      -- 是否捐贈
  donate_code TEXT,                       -- 愛心碼

  -- 金額
  sales_amount DECIMAL(10,2) NOT NULL,    -- 銷售額（未稅）
  tax_amount DECIMAL(10,2) NOT NULL,      -- 稅額
  total_amount DECIMAL(10,2) NOT NULL,    -- 含稅總額

  -- 狀態
  status TEXT DEFAULT 'issued',           -- issued / voided / allowanced
  einvoice_status TEXT DEFAULT 'pending', -- pending / uploaded / failed
  einvoice_response JSONB,               -- 加值中心回傳資料

  -- 作廢 / 折讓
  void_reason TEXT,
  void_date TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_order_id ON invoices(order_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);
CREATE INDEX idx_invoices_status ON invoices(status);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own invoices"
  ON invoices FOR ALL
  USING (auth.uid() = user_id);

-- ========================================
-- 5. invoice_track_numbers (發票字軌管理)
-- ========================================
CREATE TABLE invoice_track_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  track_prefix TEXT NOT NULL,             -- 字軌（如 AB）
  year_month TEXT NOT NULL,               -- 期別（如 11502 = 114年1-2月）
  start_number INTEGER NOT NULL,          -- 起始號碼
  end_number INTEGER NOT NULL,            -- 結束號碼
  current_number INTEGER NOT NULL,        -- 目前用到的號碼

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_track_numbers_user ON invoice_track_numbers(user_id);

ALTER TABLE invoice_track_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own track numbers"
  ON invoice_track_numbers FOR ALL
  USING (auth.uid() = user_id);
```

### 6.2 關鍵 Database Function：安全建單

```sql
-- 在一個 Transaction 內完成：建訂單 + 寫明細 + 扣庫存
-- 避免超賣的原子操作

CREATE OR REPLACE FUNCTION create_pos_order(
  p_user_id UUID,
  p_payment_method TEXT,
  p_items JSONB,  -- [{ product_id, quantity, unit_price }]
  p_discount_amount DECIMAL DEFAULT 0,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_order_id UUID;
  v_order_number TEXT;
  v_subtotal DECIMAL := 0;
  v_tax_amount DECIMAL := 0;
  v_total DECIMAL := 0;
  v_item JSONB;
  v_stock INTEGER;
  v_product_name TEXT;
  v_product_barcode TEXT;
  v_item_subtotal DECIMAL;
BEGIN
  -- 生成訂單編號
  v_order_number := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    LPAD(
      (SELECT COALESCE(COUNT(*), 0) + 1 FROM orders
       WHERE user_id = p_user_id
       AND created_at::date = CURRENT_DATE)::TEXT,
      4, '0'
    );

  -- 驗證庫存 & 計算金額
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT stock, name, barcode INTO v_stock, v_product_name, v_product_barcode
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    AND user_id = p_user_id
    FOR UPDATE;  -- 鎖定行，防止並發超賣

    IF v_stock < (v_item->>'quantity')::INTEGER THEN
      RAISE EXCEPTION '商品「%」庫存不足（剩餘 %，需要 %）',
        v_product_name, v_stock, (v_item->>'quantity')::INTEGER;
    END IF;

    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  -- 計算稅額（台灣營業稅 5%，內含式）
  v_tax_amount := ROUND(v_subtotal * 5 / 105, 0);
  v_total := v_subtotal - p_discount_amount;

  -- 建立訂單
  INSERT INTO orders (id, user_id, order_number, status, payment_method,
    subtotal, tax_amount, discount_amount, total_amount, note)
  VALUES (gen_random_uuid(), p_user_id, v_order_number, 'paid', p_payment_method,
    v_subtotal, v_tax_amount, p_discount_amount, v_total, p_note)
  RETURNING id INTO v_order_id;

  -- 寫入明細 & 扣庫存
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT name, barcode INTO v_product_name, v_product_barcode
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;

    INSERT INTO order_items (order_id, product_id, product_name, product_barcode,
      quantity, unit_price, subtotal)
    VALUES (v_order_id, (v_item->>'product_id')::UUID, v_product_name, v_product_barcode,
      (v_item->>'quantity')::INTEGER, (v_item->>'unit_price')::DECIMAL, v_item_subtotal);

    UPDATE products
    SET stock = stock - (v_item->>'quantity')::INTEGER,
        updated_at = NOW()
    WHERE id = (v_item->>'product_id')::UUID;
  END LOOP;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 七、狀態管理設計

### 7.1 Zustand Store 結構

```typescript
// store/usePosStore.ts

interface CartItem {
  productId: string;
  name: string;
  barcode?: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
}

interface PosState {
  // 購物車
  cart: CartItem[];
  addToCart: (product: Product) => void;       // Optimistic UI
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, qty: number) => void;
  clearCart: () => void;

  // 金額
  subtotal: number;       // 小計
  taxAmount: number;      // 稅額（自動計算）
  discountAmount: number; // 折扣
  totalAmount: number;    // 總計
  setDiscount: (amount: number) => void;

  // 發票
  invoiceType: 'B2C' | 'B2B';
  buyerIdentifier: string;        // 統編
  carrierType: string | null;     // 載具類型
  carrierId: string | null;       // 載具號碼
  donateCode: string | null;      // 愛心碼
  setInvoiceInfo: (info: Partial<InvoiceInfo>) => void;

  // UI 狀態
  isCheckoutOpen: boolean;
  isScannerOpen: boolean;
  isProcessing: boolean;
  selectedCategory: string | null;
  searchQuery: string;
}
```

### 7.2 Optimistic UI 策略

```
使用者點擊商品
    │
    ▼
Zustand 立即更新購物車（< 16ms）
    │
    ├── 畫面立即反應（新增品項 + 動畫）
    │
    ▼
結帳時才呼叫 Server Action → RPC create_pos_order()
    │
    ├── 成功 → 清空購物車 + 顯示收據
    └── 失敗 → 顯示錯誤 Toast + 保留購物車（可重試）
```

---

## 八、離線支援方案

### 8.1 架構

```
Service Worker (next-pwa)
    │
    ├── 快取策略：
    │   ├── 靜態資源 → Cache First
    │   ├── 商品資料 → Stale While Revalidate
    │   └── API 請求 → Network First (失敗時 fallback)
    │
    └── IndexedDB (idb-keyval)
        ├── 商品快取（定期同步）
        └── 離線訂單佇列（恢復連線後自動上傳）
```

### 8.2 離線結帳流程

1. 偵測到離線 → 顯示橘色 OfflineIndicator
2. 允許繼續結帳 → 訂單存入 IndexedDB（狀態 = `offline_pending`）
3. 恢復連線 → Background Sync 自動上傳離線訂單
4. 上傳成功 → 更新訂單狀態 + 開立電子發票

---

## 九、開發時程與分期

### Phase 1：基礎建設（第 1-2 週）

| 任務 | 說明 |
|------|------|
| DB Migration | 建立 products, orders, order_items, invoices 表 |
| 商品 CRUD | `/dashboard/pos/products` 商品管理頁面 |
| Zustand Store | 建立 `usePosStore` 購物車狀態管理 |
| POS Layout | 全螢幕橫式佈局 + 響應式 |

### Phase 2：核心銷售（第 3-4 週）

| 任務 | 說明 |
|------|------|
| ProductGrid | 商品網格 + 分類篩選 + 搜尋 |
| CartSection | 購物車 + 數量增減 + 小計 |
| BarcodeScanner | html5-qrcode 相機掃碼 + 掃碼槍監聽 |
| CheckoutDialog | 結帳彈窗 + 付款方式選擇 |
| RPC create_pos_order | 安全建單函數 |

### Phase 3：電子發票（第 5-6 週）

| 任務 | 說明 |
|------|------|
| 加值中心串接 | 綠界 ECPay 電子發票 API |
| InvoiceForm | 統編 / 載具 / 捐贈 表單 |
| 發票字軌管理 | 字軌配號 + 自動遞增 |
| 發票作廢 / 折讓 | 作廢與折讓 API |
| 發票查詢 | `/dashboard/pos/invoices` 管理頁面 |

### Phase 4：進階功能（第 7-8 週）

| 任務 | 說明 |
|------|------|
| 離線模式 | Service Worker + IndexedDB |
| 庫存管理 | 進貨、盤點、低庫存警示 |
| 報表 | 日結報表、營業額分析、熱銷排行 |
| 多元支付 | 藍新金流串接（信用卡、LINE Pay） |
| 列印 | 熱感應印表機 ESC/POS 指令 |

---

## 十、安全性考量

| 面向 | 策略 |
|------|------|
| 資料隔離 | Supabase RLS 確保每個商家只能存取自己的資料 |
| 防超賣 | Database Function 使用 `FOR UPDATE` 行鎖定 |
| 發票安全 | 加值中心 API Key 存於環境變數，Server-side only |
| 金流安全 | 所有金流交易走 Server Action，前端不接觸金鑰 |
| 輸入驗證 | 全面使用 Zod Schema 驗證前後端資料 |
| HTTPS | 相機掃碼需要安全來源（Secure Context） |

---

## 十一、需安裝的新依賴

```bash
# 相機掃碼
npm install html5-qrcode

# 離線支援
npm install next-pwa idb-keyval

# 數字格式化（新台幣）
npm install numeral  # 或使用 Intl.NumberFormat (原生)

# 熱感應印表機（Phase 4）
npm install escpos escpos-usb  # 或 WebUSB API
```

---

## 十二、與現有母版的整合點

| 母版既有模組 | POS 如何利用 |
|-------------|-------------|
| `categories` 表 | 直接作為商品分類，共用分類樹 |
| `profiles` 表 | 商家帳號、認證、權限 |
| Supabase Auth | 登入 / 權限控制 |
| Shadcn UI 元件庫 | Card, Button, Dialog, Sheet, Input, Badge... |
| Zustand | 擴展新的 `usePosStore` |
| Tailwind CSS | 統一設計語言 |
| Stripe 模組 | Phase 4 可保留作為國際支付選項 |

---

## 附錄 A：參考資源

- [Square POS Design Principles](https://agentestudio.com/blog/design-principles-pos-interface)
- [ConnectPOS PWA Architecture](https://www.connectpos.com/top-pwa-pos-system/)
- [2026 POS Technology Trends](https://mobidev.biz/blog/pos-technology-trends-innovations-reshaping-point-of-sale-experience)
- [財政部電子發票整合服務平台](https://www.einvoice.nat.gov.tw/)
- [財政部電子發票 API 使用規範](https://law-out.mof.gov.tw/LawContent.aspx?id=GL010122)
- [綠界 ECPay 電子發票 SDK (GitHub)](https://github.com/ECPay/Invoice_Net)
- [html5-qrcode Library](https://github.com/mebjas/html5-qrcode)
- [鯨躍電子發票串接](https://www.cetustek.com.tw/cloud-invoice-api.html)
- [Figma POS UI Template](https://www.figma.com/community/file/1378764578696265467/pos-system-web-ui)

---

> **下一步**：確認本計畫書內容無誤後，請告知要從哪個 Phase 開始執行，我將依序產出程式碼。
