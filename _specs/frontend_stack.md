# 前端技術棧與 UI 組件選型

## 核心技術棧

- **框架**: Next.js 14+ (App Router)
- **UI 基礎**: Shadcn/UI + Tailwind CSS
- **狀態管理**: React Server Components + Zustand (客戶端狀態)
- **表單處理**: React Hook Form + Zod
- **數據獲取**: Supabase Client + Server Actions

---

## UI 組件選型決策

### 1. 無限層級分類樹 (Tree View)

#### 選型決策：`@dnd-kit` + `@dnd-kit/sortable` + 自定義 Tree 組件

**技術方案**：
- **核心庫**: `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`
- **原因**：
  1. ✅ 與 Shadcn/UI 設計系統完美兼容（無預設樣式，完全可控）
  2. ✅ 支持無限層級嵌套
  3. ✅ 拖拽體驗流暢，支持鍵盤無障礙操作
  4. ✅ 輕量級（~10KB gzipped），性能優秀
  5. ✅ TypeScript 原生支持
  6. ✅ 活躍維護，文檔完善

**替代方案評估**：
- ❌ `react-arborist`: 功能強大但過於複雜，樣式定制困難
- ❌ `react-beautiful-dnd`: 不支援嵌套拖拽，已停止維護
- ❌ `react-sortable-tree`: 依賴舊版 React，不支援 React 18+

#### 安裝指令

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

#### 組件結構

```
components/ui/
├── tree-view.tsx           # 基礎 Tree View 組件（Shadcn 風格）
├── sortable-tree.tsx       # 可拖拽 Tree 組件（基於 dnd-kit）
└── category-tree.tsx       # 分類樹業務組件（封裝 sortable-tree）
```

#### 核心特性

1. **無限層級支持**
   ```typescript
   interface TreeNode {
     id: string;
     label: string;
     children?: TreeNode[];
     // 支持無限嵌套
   }
   ```

2. **拖拽功能**
   - 支持同一層級內排序
   - 支持跨層級移動
   - 視覺反饋（拖拽預覽、放置指示器）

3. **鍵盤無障礙**
   - Tab 導航
   - 方向鍵展開/折疊
   - Enter/Space 選擇
   - Delete 刪除節點

4. **Shadcn/UI 風格**
   - 使用 `cn()` 工具函數
   - 支持 `className` 覆蓋
   - 符合設計系統的間距、顏色、動畫

#### 使用示例

```tsx
import { CategoryTree } from '@/components/ui/category-tree';

const categories = [
  {
    id: '1',
    label: '電子產品',
    children: [
      { id: '1-1', label: '手機' },
      { id: '1-2', label: '筆記本電腦' },
    ],
  },
];

<CategoryTree
  data={categories}
  onNodeMove={(nodeId, newParentId) => {
    // 處理節點移動
  }}
  onNodeSelect={(nodeId) => {
    // 處理節點選擇
  }}
/>
```

---

### 2. 表單組件

- **表單庫**: React Hook Form
- **驗證**: Zod (與後端 Schema 共享)
- **UI 組件**: Shadcn/UI Form 組件

---

### 3. 數據表格

- **選型**: Shadcn/UI Table + TanStack Table (React Table)
- **原因**: 輕量、靈活、TypeScript 支持完善

---

### 4. 對話框與彈窗

- **選型**: Shadcn/UI Dialog, Sheet, Popover
- **原因**: 統一設計語言，無障礙支持完善

---

### 5. 圖標庫

- **選型**: Lucide React
- **原因**: 
  - Shadcn/UI 官方推薦
  - 圖標豐富（1000+）
  - Tree-shaking 友好
  - 與 Tailwind CSS 完美配合

---

## 性能優化策略

### 1. 代碼分割
- 路由級別自動分割（Next.js App Router）
- 動態導入大型組件（如 Tree View）

### 2. 虛擬滾動
- 大列表使用 `@tanstack/react-virtual`
- Tree View 支持虛擬化（>1000 節點時）

### 3. 狀態優化
- Server Components 優先
- 客戶端狀態最小化（僅 UI 狀態）
- 使用 React `useTransition` 優化交互

---

## 無障礙 (A11y) 標準

- **WCAG 2.1 AA 級別**合規
- 鍵盤導航完整支持
- ARIA 屬性正確標記
- 螢幕閱讀器友好

---

## 瀏覽器支持

- Chrome/Edge (最新 2 個版本)
- Firefox (最新 2 個版本)
- Safari (最新 2 個版本)
- 移動端 Safari/Chrome (iOS 14+, Android 10+)

---

## 開發工具

- **類型檢查**: TypeScript 5+
- **代碼格式化**: Prettier
- **Linting**: ESLint + Next.js 配置
- **測試**: Vitest + React Testing Library (未來)

---

## 依賴管理原則

1. **最小依賴**: 優先使用原生 API 或輕量庫
2. **版本鎖定**: 使用 `package-lock.json` 鎖定版本
3. **定期更新**: 每月檢查安全更新
4. **Tree-shaking**: 確保構建工具支持，移除未使用代碼

---

## 更新日誌

### 2026-02-05
- ✅ 選定 `@dnd-kit` 作為 Tree View 解決方案
- ✅ 確定 Shadcn/UI 作為設計系統基礎
- ✅ 建立組件選型文檔
