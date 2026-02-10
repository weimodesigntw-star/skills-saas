# 🎯 最終測試指南

## 準備工作

### 1. 安裝依賴

```bash
# 核心依賴
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @supabase/supabase-js @supabase/ssr
npm install react-hook-form @hookform/resolvers zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-alert-dialog @radix-ui/react-label @radix-ui/react-slot
npm install clsx tailwind-merge class-variance-authority
npm install lucide-react
```

### 2. 安裝 Shadcn UI 組件

```bash
npx shadcn-ui@latest init  # 如果還沒初始化
npx shadcn-ui@latest add dialog form dropdown-menu alert-dialog input label textarea button card
```

### 3. 執行數據庫 Migration

在 Supabase SQL Editor 中執行：

1. **創建 categories 表**（如果還沒有）
   - 見 `QUICK_START.md` 或 `TREE_VIEW_SETUP.md`

2. **創建級聯刪除 RPC 函數**
   ```sql
   -- 見文件：supabase/migrations/001_cascade_delete_category.sql
   ```

---

## 🧪 測試場景

### 場景 1: 無限層級測試

**目標**：驗證分類樹支持無限層級嵌套

**步驟**：
1. 訪問 `/dashboard/categories`
2. 創建分類：`服飾`
3. 在「服飾」下新增子分類：`男裝`
4. 在「男裝」下新增子分類：`上衣`
5. 在「上衣」下新增子分類：`T恤`

**預期結果**：
- ✅ 所有分類正確顯示在樹狀結構中
- ✅ 可以展開/收合各層級
- ✅ 層級縮進正確顯示

---

### 場景 2: 級聯刪除測試

**目標**：驗證刪除父分類會連同刪除所有子分類

**前置條件**：完成場景 1，已創建多層級分類

**步驟**：
1. 點擊「男裝」分類右側的操作選單
2. 選擇「刪除」
3. 在確認對話框中：
   - ✅ 確認顯示警告訊息
   - ✅ 確認顯示將被刪除的子分類數量（應該是 2 個：上衣、T恤）
4. 點擊「確認刪除」

**預期結果**：
- ✅ 確認對話框顯示正確的警告
- ✅ 刪除後，「男裝」、「上衣」、「T恤」都從列表中消失
- ✅ 檢查 Supabase 數據庫，確認所有相關記錄都被刪除
- ✅ 沒有出現孤兒節點

**驗證 SQL**：
```sql
-- 在 Supabase SQL Editor 執行
SELECT * FROM categories WHERE name IN ('男裝', '上衣', 'T恤');
-- 應該返回 0 行
```

---

### 場景 3: 移動端適配測試

**目標**：驗證操作選單在移動設備上可用

**步驟**：
1. 打開瀏覽器開發者工具（F12）
2. 切換到設備模擬模式（iPhone 12 Pro 或 iPad）
3. 訪問 `/dashboard/categories`
4. 觀察分類節點

**預期結果**：
- ✅ 操作選單（三點圖標）始終可見（不依賴 hover）
- ✅ 點擊操作選單可以正常打開
- ✅ 可以正常執行編輯、新增、刪除操作
- ✅ 對話框在移動端正常顯示和操作

**對比測試**：
- 切換回桌面模式
- 確認操作選單在 hover 時才顯示
- 確認兩種模式下功能都正常

---

### 場景 4: AI 功能測試

**目標**：驗證 AI 生成描述功能

**步驟**：
1. 點擊任意分類的操作選單
2. 選擇「編輯」
3. 在編輯對話框中：
   - 輸入分類名稱（例如：「運動服飾」）
   - 點擊描述欄位右上角的「✨ AI 潤飾」按鈕
4. 觀察：
   - ✅ 按鈕顯示「生成中...」和 Spinner
   - ✅ Textarea 顯示 Loading 遮罩
   - ✅ 描述欄位自動填入生成的內容
5. 測試撤銷功能：
   - ✅ 點擊「復原」按鈕
   - ✅ 描述欄位恢復為空或之前的值

**預期結果**：
- ✅ AI 生成按鈕正常工作
- ✅ Loading 狀態正確顯示
- ✅ 生成的描述符合格式要求（20-200 字）
- ✅ 撤銷功能正常
- ✅ 錯誤處理正常（例如：網絡錯誤時顯示錯誤訊息）

**錯誤測試**：
1. 不輸入分類名稱，直接點擊「AI 潤飾」
   - ✅ 應該提示「請先輸入分類名稱」
2. 模擬網絡錯誤
   - ✅ 應該顯示錯誤訊息

---

### 場景 5: 拖拽排序測試

**目標**：驗證拖拽功能正常

**步驟**：
1. 創建多個同層級分類（例如：`服飾`、`3C`、`傢俱`）
2. 拖拽「3C」到「服飾」之前
3. 拖拽「傢俱」到「3C」內部（作為子分類）

**預期結果**：
- ✅ 拖拽時顯示 DragOverlay（半透明卡片）
- ✅ 排序正確更新
- ✅ 跨層級移動正常
- ✅ 數據庫中的 `sort_order` 和 `parent_id` 正確更新

---

### 場景 6: 表單驗證測試

**目標**：驗證 Zod 表單驗證

**步驟**：
1. 打開編輯對話框
2. 測試名稱驗證：
   - 留空名稱 → ✅ 顯示「名稱不能為空」
   - 輸入超過 50 個字元 → ✅ 顯示「名稱不能超過 50 個字元」
3. 測試描述驗證：
   - 輸入超過 200 個字元 → ✅ 顯示「描述不能超過 200 個字元」

**預期結果**：
- ✅ 所有驗證規則正常工作
- ✅ 錯誤訊息清晰明確
- ✅ 無法提交無效表單

---

## 🐛 常見問題排查

### 問題 1: 操作選單在移動端不顯示

**解決方案**：
1. 確認 `TreeItem.tsx` 已更新為使用響應式類別
2. 清除瀏覽器緩存
3. 確認 Tailwind CSS 配置正確

### 問題 2: 級聯刪除不工作

**解決方案**：
1. 確認已執行 RPC 函數 Migration
2. 檢查 Supabase 數據庫中的函數是否存在：
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'delete_category_cascade';
   ```
3. 檢查 RLS 策略是否正確

### 問題 3: AI 功能不工作

**解決方案**：
1. 檢查 API 路由是否正確：`/api/categories/ai-description`
2. 檢查瀏覽器控制台是否有錯誤
3. 確認網絡請求正常（檢查 Network 標籤）

---

## ✅ 測試完成檢查清單

- [ ] 無限層級分類正常顯示
- [ ] 級聯刪除正常工作（無孤兒節點）
- [ ] 移動端操作選單可見且可用
- [ ] AI 生成描述功能正常
- [ ] 拖拽排序功能正常
- [ ] 表單驗證正常工作
- [ ] 所有對話框正常顯示和關閉
- [ ] 錯誤處理正常（網絡錯誤、驗證錯誤等）
- [ ] 數據刷新正常（操作後列表更新）

---

## 🎉 完成！

如果所有測試都通過，恭喜！您的分類管理系統已經：

1. ✅ **移動端友好** - 操作選單在觸控設備上可用
2. ✅ **事務安全** - 級聯刪除使用數據庫事務，避免孤兒節點
3. ✅ **AI 增強** - 自動生成專業的分類描述
4. ✅ **用戶體驗優秀** - 完整的 CRUD、拖拽、驗證功能

現在您可以：
- 開始使用系統管理分類
- 整合真實的 AI API（Vercel AI SDK）
- 根據需求進一步自定義功能

祝使用愉快！🚀
