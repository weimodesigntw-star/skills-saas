# 軌道 B：POS 模組任務書

> **本文件供獨立的 Cowork Session 使用**
> 複製以下內容作為 Session 的啟動提示詞

---

## 專案上下文

你正在開發一個 SaaS 平台 (Next.js 14 + Supabase + Shadcn UI)。
Sprint 0（共享基礎建設）已完成，包含：

- ✅ Dashboard 側邊欄 Layout (`components/layout/Sidebar.tsx` + `app/dashboard/layout.tsx`)
- ✅ 共用元件：Toast, EmptyState, Skeleton, ConfirmDialog, Sheet, Separator, Tooltip
- ✅ DB Migration：products, orders, order_items, invoices, invoice_track_numbers 表
- ✅ RPC Function：`create_pos_order()` 原子交易（防超賣）
- ✅ 常數檔 `lib/constants.ts`（稅率、幣別、付款方式、發票）

## 你的任務：軌道 B — POS 模組開發

**你只能修改以下路徑的檔案，不要動 `components/category/`, `components/specification/`, 或 `app/dashboard/specifications/`：**

### Sprint B1：POS 基礎 + 商品管理

1. **B1-1**: `app/dashboard/pos/layout.tsx`
   - POS 專屬全螢幕 Layout（隱藏側邊欄）
   - 頂部工具列：返回 Dashboard / 設定 / 全螢幕切換

2. **B1-2**: `store/usePosStore.ts`
   - Zustand 購物車：addToCart, removeFromCart, updateQuantity, clearCart
   - 自動計算 subtotal, taxAmount (5% 內含), discountAmount, totalAmount
   - 發票資訊狀態
   - 參考 `lib/constants.ts` 的 `calcTaxIncluded()`

3. **B1-3**: `app/actions/pos.ts`
   - fetchProducts(userId, categoryId?, search?)
   - fetchCategories(userId)
   - createOrder(通過 Supabase RPC: create_pos_order)

4. **B1-4**: `app/dashboard/pos/products/page.tsx`
   - 商品 CRUD 管理頁（列表 + 新增/編輯 Dialog）
   - 欄位：名稱、價格、庫存、條碼、分類、圖片

5. **B1-5**: `scripts/seed-products.ts`
   - 20 筆範例商品（茶葉、茶具、禮盒等）

### Sprint B2：POS 銷售介面

1. **B2-1**: `app/dashboard/pos/page.tsx`
   - POS 主畫面，左右分割
   - 參考 POS_MODULE_PLAN.md 第三章的佈局規範

2. **B2-2**: `components/pos/ProductGrid.tsx` + `ProductCard.tsx`
   - 網格佈局（auto-fill, min 120px）
   - 圖片 Lazy Loading
   - 庫存徽章（< 5 橘色、= 0 灰化）
   - 點擊 → addToCart (Optimistic UI)

3. **B2-3**: `components/pos/CategoryTabs.tsx`
   - 橫向滾動頁籤，色塊區分

4. **B2-4**: `components/pos/CartSection.tsx` + `CartItem.tsx` + `CartSummary.tsx`
   - 數量 Stepper (- / qty / +)
   - 結帳按鈕 h-16 綠色

5. **B2-5**: `components/pos/SearchBar.tsx`
   - 即時搜尋 debounce 300ms

### Sprint B3：掃碼 + 結帳

1. **B3-1**: `lib/hooks/useBarcodeScanner.ts`
   - 全域 keydown 監聽，快速輸入 + Enter 偵測
   - 間隔閾值：`BARCODE_SCANNER_INTERVAL_MS` (50ms)

2. **B3-2**: `components/pos/BarcodeScanner.tsx`
   - html5-qrcode 相機掃碼（需先 `npm install html5-qrcode`）
   - 全螢幕掃描覆蓋層 + 前後鏡頭切換

3. **B3-3**: `components/pos/CheckoutDialog.tsx`
   - 付款方式選擇（參考 `PAYMENT_METHODS` 常數）
   - 現金模式：NumPad 輸入 → 顯示找零
   - 呼叫 `createOrder` Server Action

4. **B3-4**: `components/pos/ReceiptPreview.tsx`
   - 電子收據預覽

5. **B3-5**: `app/dashboard/pos/orders/page.tsx` + `[id]/page.tsx`
   - 訂單歷史列表 + 明細頁

### Sprint B4：電子發票

1. **B4-1**: `lib/einvoice/ecpay.ts`
   - 綠界 ECPay 電子發票 API 串接
   - AES 加密 + SHA256

2. **B4-2**: `components/pos/InvoiceForm.tsx`
   - B2C/B2B 切換、統編驗證、載具、愛心碼

3. **B4-3**: `app/dashboard/pos/invoices/page.tsx`
   - 發票列表 / 作廢操作

## 設計規範速查

### POS 主畫面佈局
```
左 65% 商品網格 | 右 35% 購物車
桌面 >= 1280px: 4-5 欄商品
平板橫向 1024-1279px: 3-4 欄
平板直向 768-1023px: 上下佈局
手機 < 768px: 全螢幕商品 + Bottom Sheet 購物車
```

### 觸控要求
- 商品卡片 min-h-[120px] min-w-[120px]
- 結帳按鈕 h-16
- Stepper 按鈕 min-w-[44px] min-h-[44px]

## 驗收標準

每完成一個檔案，執行 `npx tsc --noEmit` 確認零錯誤。
