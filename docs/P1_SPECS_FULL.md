# P1 全部規格

> 小龍蝦團隊開發對照用。優先順序建議：**P1-2 → P1-1 → P1-4 → P1-3**

---

## 專案表名對齊（實作時必看）

| 規格/文件寫法 | 實際 DB 表名 |
|---------------|----------------|
| `pos_orders` | **`orders`** |
| `pos_order_items` | **`order_items`** |

Dashboard 營收/訂單/熱賣查詢皆用 `orders`、`order_items`。

---

## P1-1｜規格系統補完 + AI 串接

> 目前狀態：Schema/API 有，部分為 stub，AI 未真實串接

### Server Actions（`app/actions/specifications.ts`）

| Action | 說明 | 目前狀態 |
|--------|------|----------|
| `fetchSpecifications(productId?)` | 取得規格列表（可選依商品篩選） | 需確認是否已實作 |
| `createSpecification(data)` | 新增規格（名稱 + 選項陣列） | 補完 |
| `updateSpecification(id, data)` | 編輯規格 | 補完 |
| `deleteSpecification(id)` | 刪除規格 | 補完 |
| `generateSpecWithAI(productName, categoryName)` | 呼叫 Gemini 生成規格建議 | **目前為 stub，需真實串接** |

### `generateSpecWithAI` 實作規格

**API**：`POST /api/specifications/ai/generate`（或於 Action 內直接呼叫 Gemini）

**Request：**
```json
{
  "productName": "string",
  "categoryName": "string",
  "existingSpecs": ["string"]
}
```
`existingSpecs` 為選填，已有規格名稱，避免重複建議。

**Prompt 範例：**
```
你是商品規格專家。商品名稱：{productName}，分類：{categoryName}。
請建議 3～5 組規格，每組包含名稱與可選值。
回傳 JSON：[{ "name": "string", "options": ["string"] }]
```

**Response：**
```json
{
  "specs": [
    { "name": "string", "options": ["string"] }
  ]
}
```

### 頁面 `/dashboard/specifications`

- **列表**：依商品或全部列出規格名稱、選項數量、操作（編輯/刪除）
- **新增/編輯 Dialog**：
  - 規格名稱（如「顏色」、「尺寸」）
  - 選項：tag-input 方式（可新增/刪除單一選項）
  - **「AI 生成建議」**按鈕 → 呼叫 `generateSpecWithAI` → 顯示建議清單供選擇套用
- **AI 建議 UI**：
  - 建議以 checkbox 列出，可全選或勾選部分
  - 套用後填入表單，使用者可再手動調整
- **配額提示**：AI 按鈕旁顯示今日剩餘 AI 配額（`consume_ai_quota` / profiles 或 quota 表）

### DB 注意

- `specifications` 表目前為 **`spec_data` JSONB**（migration 008）；若規格為「名稱 + 選項陣列」，可存於 `spec_data` 如 `{ "name": "顏色", "options": ["紅","藍"] }` 或依既有結構擴充。
- 新增/更新時需驗證選項不得為空陣列。

---

## P1-2｜AI 分類描述補父分類上下文

> 目前狀態：可生成描述，但未帶入父分類資訊，導致描述缺乏層級語意

### 修改位置：`EditCategoryDialog`

**目前 prompt 大致為：**
```
為分類「{name}」生成一段描述
```

**改為帶入完整路徑：**
```
為分類「{fullPath}」生成一段繁體中文描述。
完整路徑：{parentChain}（例：電子產品 > 手機 > 配件）
請描述此分類的商品範圍，約 50 字。
```

### 實作步驟

1. `EditCategoryDialog` 開啟時，從 category tree store 或 props 取得 **ancestors**（父層分類）
2. 組合 **parentChain**：`ancestors.map(a => a.name).join(' > ') + ' > ' + currentName`（或僅父層 + 當前名稱）
3. 將 `parentChain` 傳入 AI generate API
4. **API**：`app/api/categories/ai-description` 或 `app/api/categories/ai/generate` 的 request body 新增 `parentChain?: string`，並調整 prompt

**API 修改範例：**
```typescript
// Request body 新增欄位
{
  name: string,
  parentChain?: string   // 如「電子產品 > 手機」
}

// Prompt 調整
const prompt = parentChain
  ? `為分類「${parentChain} > ${name}」生成繁體中文描述，約 50 字。`
  : `為分類「${name}」生成繁體中文描述，約 50 字。`
```

---

## P1-3｜Dashboard 總覽補圖表與指標

> 目前狀態：已接資料，圖表與關鍵指標待補  
> ⚠️ 查詢請用表名 **`orders`**、**`order_items`**（非 pos_orders）

### 新增指標卡（`/dashboard`）

| 指標 | 資料來源 | 說明 |
|------|----------|------|
| 今日營收 | `orders` | `WHERE DATE(created_at) = CURRENT_DATE AND status = 'paid'`，SUM(total_amount) |
| 本月營收 | `orders` | 本月累計，同上 status |
| 今日訂單數 | `orders` | 今日且 status = 'paid'，COUNT(*) |
| 低庫存商品數 | `products` | `WHERE stock <= low_stock_threshold`（預設 5） |

### 圖表一：近 7 日銷售趨勢（折線圖）

- **X 軸**：近 7 天日期  
- **Y 軸**：每日營收金額  

**查詢（PostgreSQL）：**
```sql
SELECT DATE(created_at) AS date, SUM(total_amount) AS revenue
FROM orders
WHERE user_id = auth.uid() AND status = 'paid'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;
```

### 圖表二：熱賣商品 Top 5（橫條圖）

- **查詢：**
```sql
SELECT p.name, SUM(oi.quantity) AS total_sold
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o ON o.id = oi.order_id
WHERE o.user_id = auth.uid() AND o.status = 'paid'
  AND o.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name
ORDER BY total_sold DESC
LIMIT 5;
```
（注意：本專案明細數量欄位為 **quantity**）

### 技術選型

- **圖表**：建議 **Recharts**（與 Shadcn 相容）
- **Server Action**：`fetchDashboardStats()` 一次回傳所有指標與圖表資料（今日/本月營收、今日訂單數、低庫存數、7 日營收陣列、Top 5 商品陣列）

---

## P1-4｜庫存頁面完整功能

> 目前狀態：路由存在，功能待補

### 頁面：`/dashboard/pos/inventory`

#### 庫存列表

- **欄位**：商品名稱、分類、SKU/條碼、目前庫存、低庫存警示（`stock <= low_stock_threshold` 標紅）、操作
- **篩選**：分類、是否低庫存
- **搜尋**：商品名稱 / 條碼

#### 庫存調整

- 點「調整」開啟 Dialog：
  - **調整類型**：補貨 / 盤虧 / 手動設定
  - **數量**：補貨/盤虧為正整數；手動設定為目標數值
  - **備註**（選填）
- 確認後寫入 **`stock_adjustments`** 表並更新 **`products.stock`**

#### 調整歷史記錄

- 頁面下方或獨立分頁：依商品或日期查詢調整記錄
- **欄位**：時間、商品、類型、調整量（+/-）、調整後庫存、備註、操作人

### Migration（若 `stock_adjustments` 表不存在）

**檔名**：`018_stock_adjustments.sql`

```sql
CREATE TABLE IF NOT EXISTS stock_adjustments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- restock / loss / manual
  qty_change   INTEGER NOT NULL,
  qty_after    INTEGER NOT NULL,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_adjustments_user_id ON stock_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_product_id ON stock_adjustments(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_created_at ON stock_adjustments(created_at DESC);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stock_adjustments"
  ON stock_adjustments FOR ALL
  USING (auth.uid() = user_id);
```

> 本專案統一使用 **profiles(id)** 作為 user 關聯，故 `user_id` 參考 `profiles(id)`。

### Server Actions（`app/actions/inventory.ts`）

| Action | 說明 |
|--------|------|
| `fetchInventory(params)` | 列表，含篩選（分類、是否低庫存）、搜尋、低庫存旗標 |
| `adjustStock(productId, type, qty, note)` | 原子操作：更新 `products.stock` + 寫入 `stock_adjustments` |
| `fetchStockHistory(productId?, dateFrom?, dateTo?)` | 調整歷史，可依商品、日期篩選 |

> ⚠️ `adjustStock` 需用 **Supabase RPC** 或 **transaction** 確保庫存與歷史記錄一致，避免並發寫入錯誤。

---

## P1 優先順序建議

| 順序 | 項目 | 說明 |
|------|------|------|
| 1 | **P1-2** AI 分類描述 | 改動小，約 30 分鐘可完成，建議先暖身 |
| 2 | **P1-1** 規格系統 | 主要開發任務，含 AI 串接與 UI |
| 3 | **P1-4** 庫存頁面 | 需新 migration，獨立性高可並行 |
| 4 | **P1-3** Dashboard | 最後，依賴 orders/order_items 資料較完整 |

---

## 相關文件

- 交接總覽：`docs/HANDOVER.md`
- 開發進度：`docs/DEVELOPMENT_PROGRESS.md`
- 軌道 A 任務書：`TRACK_A_SKILLS.md`
- 軌道 B（POS）：`TRACK_B_POS.md`
- Schema 說明：`_specs/02_schema.md`
