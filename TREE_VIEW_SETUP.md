# Tree View 組件設置指南

## ✅ 已完成的工作

### Step 1: 狀態管理 (The Brain)
- ✅ `lib/types/category.ts` - Category 類型定義
- ✅ `store/useCategoryStore.ts` - Zustand Store（管理展開/收合/拖曳狀態）

### Step 2: 遞迴組件 (The Body)
- ✅ `components/category/TreeItem.tsx` - 遞迴樹節點組件
- ✅ `components/category/SortableTree.tsx` - 可拖拽樹組件（使用 @dnd-kit）

### Step 3: 整合頁面 (The Assembly)
- ✅ `app/dashboard/categories/page.tsx` - Server Component 頁面
- ✅ `app/dashboard/categories/CategoryTreeClient.tsx` - Client Component
- ✅ `app/actions/categories.ts` - Server Actions（CRUD + 拖拽排序）

### 數據庫 Schema
- ✅ `_specs/02_schema.md` - 已添加 `categories` 表定義

---

## 📦 安裝依賴

```bash
# 核心依賴
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Shadcn/UI 依賴（如果還沒有）
npm install clsx tailwind-merge class-variance-authority
npm install @radix-ui/react-slot

# Lucide React（圖標）
npm install lucide-react
```

---

## 🗄️ 數據庫設置

### 1. 在 Supabase 中執行 SQL

打開 Supabase SQL Editor，執行以下 SQL：

```sql
-- 創建 categories 表
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  
  -- 排序順序（同一層級內）
  sort_order INTEGER DEFAULT 0,
  
  -- 路徑（用於快速查詢，例如：/服飾/上衣/T恤）
  path TEXT,
  
  -- 元數據
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引策略
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_sort_order ON categories(parent_id, sort_order);
CREATE INDEX idx_categories_path ON categories(path);

-- RLS 策略
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own categories"
  ON categories
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL);

-- 更新時間觸發器
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 2. 插入測試數據（可選）

```sql
-- 假設你已經有 user_id，替換為實際的 UUID
INSERT INTO categories (user_id, name, description, parent_id, sort_order) VALUES
  ('your-user-id', '服飾', '服裝相關分類', NULL, 0),
  ('your-user-id', '3C', '電子產品', NULL, 1),
  ('your-user-id', '傢俱', '傢俱相關', NULL, 2),
  ('your-user-id', '上衣', '上衣類別', (SELECT id FROM categories WHERE name = '服飾' LIMIT 1), 0),
  ('your-user-id', '下裝', '下裝類別', (SELECT id FROM categories WHERE name = '服飾' LIMIT 1), 1);
```

---

## 🔧 環境變數設置

確保 `.env.local` 包含：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 🚀 使用方式

### 訪問頁面

訪問 `/dashboard/categories` 即可看到分類樹。

### 功能特性

1. **拖拽排序**
   - 拖拽節點手柄（六個點圖標）可以重新排序
   - 支持同一層級內排序
   - 支持跨層級移動

2. **展開/收合**
   - 點擊節點左側的箭頭圖標展開/收合子節點

3. **編輯/刪除**
   - 滑鼠懸停在節點上會顯示編輯/刪除按鈕
   - 點擊編輯按鈕（鉛筆圖標）編輯分類
   - 點擊刪除按鈕（垃圾桶圖標）刪除分類

4. **視覺反饋**
   - 拖拽時顯示 DragOverlay（半透明卡片跟隨滑鼠）
   - 選中的節點有高亮邊框

---

## 🐛 故障排除

### 問題：拖拽不工作

**解決方案**：
1. 確認已安裝 `@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`
2. 檢查瀏覽器控制台是否有錯誤
3. 確認 `useCategoryStore` 已正確初始化

### 問題：數據不顯示

**解決方案**：
1. 確認 Supabase 連接正常
2. 檢查 RLS 策略是否正確設置
3. 確認用戶已登入
4. 檢查 `getCategories` Server Action 是否正常執行

### 問題：樣式不正確

**解決方案**：
1. 確認已安裝 Shadcn/UI 組件
2. 確認 `lib/utils.ts` 中的 `cn` 函數正確
3. 確認 Tailwind CSS 配置正確

---

## 📝 下一步開發

### TODO

- [ ] 實作「新增分類」對話框
- [ ] 實作「編輯分類」對話框
- [ ] 添加批量操作功能
- [ ] 添加搜索/過濾功能
- [ ] 添加鍵盤快捷鍵支持
- [ ] 優化大數據量性能（虛擬滾動）

---

## 🎯 核心技術要點

1. **遞迴渲染**：`TreeItem` 組件遞迴調用自己渲染子節點
2. **狀態管理**：使用 Zustand 管理複雜的樹狀狀態
3. **拖拽實現**：使用 `@dnd-kit` 實現跨層級拖拽
4. **數據同步**：Server Actions 確保數據一致性
5. **性能優化**：扁平化數據結構，按需渲染

---

## 📚 參考文檔

- [@dnd-kit 官方文檔](https://docs.dndkit.com/)
- [Zustand 文檔](https://github.com/pmndrs/zustand)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [Shadcn/UI 文檔](https://ui.shadcn.com/)
