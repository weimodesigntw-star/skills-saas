# 🚀 Tree View 快速開始指南

## 立即執行的 Action List

### 1. 安裝 npm 依賴

```bash
# 核心依賴
npm install zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# 表單與驗證
npm install react-hook-form @hookform/resolvers zod

# Radix UI（Shadcn 依賴）
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-alert-dialog @radix-ui/react-label @radix-ui/react-slot

# 工具庫
npm install clsx tailwind-merge class-variance-authority

# 圖標
npm install lucide-react
```

### 2. 安裝 Shadcn UI 組件（非常重要！）

**⚠️ 注意**：`npm install` 不會安裝 UI 組件代碼，必須使用 Shadcn CLI：

```bash
# 如果還沒初始化 Shadcn
npx shadcn-ui@latest init

# 一次性安裝所有需要的組件
npx shadcn-ui@latest add dialog form dropdown-menu alert-dialog input label textarea button card
```

### 3. 執行數據庫 Migration

在 Supabase SQL Editor 中執行以下 SQL：

```sql
-- 創建 categories 表
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  
  sort_order INTEGER DEFAULT 0,
  path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
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

-- 更新時間觸發器（如果還沒有 create 函數）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 4. 設置環境變數

確保 `.env.local` 包含：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 5. 測試功能

1. 啟動開發服務器：`npm run dev`
2. 訪問 `/dashboard/categories`
3. 測試功能：
   - ✅ 拖拽排序
   - ✅ 展開/收合
   - ✅ 編輯分類
   - ✅ 新增子分類
   - ✅ 刪除分類（級聯刪除）

---

## 📋 檢查清單

### 依賴檢查

- [ ] `zustand` 已安裝
- [ ] `@dnd-kit/*` 已安裝
- [ ] `@supabase/*` 已安裝
- [ ] `react-hook-form` 和 `zod` 已安裝
- [ ] `@radix-ui/*` 已安裝
- [ ] `lucide-react` 已安裝

### Shadcn UI 組件檢查

- [ ] `components/ui/dialog.tsx` 存在
- [ ] `components/ui/form.tsx` 存在
- [ ] `components/ui/dropdown-menu.tsx` 存在
- [ ] `components/ui/alert-dialog.tsx` 存在
- [ ] `components/ui/input.tsx` 存在
- [ ] `components/ui/label.tsx` 存在
- [ ] `components/ui/textarea.tsx` 存在
- [ ] `components/ui/button.tsx` 存在
- [ ] `components/ui/card.tsx` 存在

### 業務組件檢查

- [ ] `components/category/TreeItem.tsx` 存在
- [ ] `components/category/SortableTree.tsx` 存在
- [ ] `components/category/CategoryActionMenu.tsx` 存在
- [ ] `components/category/EditCategoryDialog.tsx` 存在
- [ ] `components/category/DeleteAlert.tsx` 存在

### 數據庫檢查

- [ ] `categories` 表已創建
- [ ] RLS 策略已設置
- [ ] 觸發器已創建
- [ ] 索引已創建

### 環境變數檢查

- [ ] `NEXT_PUBLIC_SUPABASE_URL` 已設置
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已設置

---

## 🎯 功能驗證

### 基本功能

1. **拖拽排序**
   - [ ] 可以拖拽節點重新排序
   - [ ] 可以跨層級移動節點
   - [ ] 拖拽時顯示 DragOverlay

2. **展開/收合**
   - [ ] 點擊箭頭可以展開/收合子節點
   - [ ] 展開狀態正確保存

3. **編輯分類**
   - [ ] 點擊選單中的「編輯」打開對話框
   - [ ] 可以修改名稱和描述
   - [ ] 表單驗證正常工作
   - [ ] 保存後數據更新

4. **新增子分類**
   - [ ] 點擊選單中的「新增子分類」打開對話框
   - [ ] 可以輸入名稱和描述
   - [ ] 保存後新分類出現在正確位置

5. **刪除分類**
   - [ ] 點擊選單中的「刪除」打開確認對話框
   - [ ] 有子節點時顯示警告
   - [ ] 確認後正確刪除（級聯刪除）

---

## 🐛 常見問題

### Q: 對話框不顯示

**A**: 確認已執行 `npx shadcn-ui@latest add dialog`，並且 `components/ui/dialog.tsx` 存在。

### Q: 表單驗證不工作

**A**: 確認已安裝 `react-hook-form`、`@hookform/resolvers` 和 `zod`。

### Q: 刪除後數據不更新

**A**: 確認 Server Action 中調用了 `revalidatePath`，Client Component 中調用了 `router.refresh()`。

### Q: 級聯刪除不工作

**A**: 確認 `deleteCategory` Server Action 已更新為支持級聯刪除，檢查 Supabase 數據庫的 `ON DELETE CASCADE` 設置。

---

## 📚 相關文檔

- [TREE_VIEW_SETUP.md](./TREE_VIEW_SETUP.md) - Tree View 設置詳細指南
- [INTERACTION_SETUP.md](./INTERACTION_SETUP.md) - 交互組件設置指南
- [INSTALLATION.md](./INSTALLATION.md) - 安裝指南

---

## ✅ 完成！

如果所有檢查項都通過，恭喜！Tree View 交互功能已完全設置完成。

現在你可以：
- 訪問 `/dashboard/categories` 使用所有功能
- 開始開發其他功能
- 根據需求自定義樣式和行為
