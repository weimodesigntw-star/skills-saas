# Tree View 交互組件設置指南

## ✅ 已完成的工作

### 1. Shadcn UI 組件
- ✅ `components/ui/dialog.tsx` - Dialog 組件
- ✅ `components/ui/form.tsx` - Form 組件（React Hook Form）
- ✅ `components/ui/dropdown-menu.tsx` - DropdownMenu 組件
- ✅ `components/ui/alert-dialog.tsx` - AlertDialog 組件
- ✅ `components/ui/input.tsx` - Input 組件
- ✅ `components/ui/label.tsx` - Label 組件
- ✅ `components/ui/textarea.tsx` - Textarea 組件

### 2. 業務組件
- ✅ `components/category/CategoryActionMenu.tsx` - 操作選單（編輯/新增子分類/刪除）
- ✅ `components/category/EditCategoryDialog.tsx` - 編輯/新增對話框（含 Zod 驗證）
- ✅ `components/category/DeleteAlert.tsx` - 刪除確認對話框（級聯刪除警告）

### 3. 整合
- ✅ `components/category/TreeItem.tsx` - 已整合所有交互組件
- ✅ `app/actions/categories.ts` - `deleteCategory` 已支持級聯刪除

---

## 📦 安裝依賴

### 1. 安裝 npm 套件

```bash
# 核心依賴（如果還沒有）
npm install react-hook-form @hookform/resolvers zod
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-alert-dialog @radix-ui/react-label
```

### 2. 安裝 Shadcn UI 組件（重要！）

**注意**：`npm install` 不會安裝 UI 組件代碼，必須使用 Shadcn CLI：

```bash
# 如果還沒初始化 Shadcn
npx shadcn-ui@latest init

# 安裝所需組件
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
```

**或者一次性安裝**：
```bash
npx shadcn-ui@latest add dialog form dropdown-menu alert-dialog input label textarea button card
```

---

## 🎯 功能說明

### 1. CategoryActionMenu（操作選單）

**位置**：節點右側，hover 時顯示

**功能**：
- **編輯**：打開編輯對話框，修改分類名稱和描述
- **新增子分類**：為當前分類新增一個子分類
- **刪除**：打開刪除確認對話框

### 2. EditCategoryDialog（編輯/新增對話框）

**功能**：
- 編輯模式：修改現有分類的名稱和描述
- 新增模式：為父分類新增子分類
- Zod 驗證：
  - 名稱：必填，1-50 個字元
  - 描述：選填，最多 200 個字元
- 提交後自動刷新數據（`router.refresh()`）

### 3. DeleteAlert（刪除確認對話框）

**功能**：
- 顯示刪除警告
- **級聯刪除提示**：
  - 如果分類有子節點，顯示警告訊息
  - 顯示將被刪除的子分類數量
  - 強調操作無法復原
- 確認後執行級聯刪除（遞迴刪除所有子節點）

---

## 🔧 使用方式

### 訪問頁面

訪問 `/dashboard/categories` 即可使用所有功能。

### 操作流程

1. **編輯分類**：
   - Hover 到分類節點
   - 點擊右側的三點選單圖標
   - 選擇「編輯」
   - 在對話框中修改名稱/描述
   - 點擊「儲存」

2. **新增子分類**：
   - Hover 到父分類節點
   - 點擊右側的三點選單圖標
   - 選擇「新增子分類」
   - 在對話框中輸入名稱/描述
   - 點擊「儲存」

3. **刪除分類**：
   - Hover 到分類節點
   - 點擊右側的三點選單圖標
   - 選擇「刪除」
   - 在確認對話框中確認刪除
   - 如果有子分類，會顯示警告和數量

---

## 🐛 故障排除

### 問題：對話框不顯示

**解決方案**：
1. 確認已執行 `npx shadcn-ui@latest add dialog`
2. 檢查 `components/ui/dialog.tsx` 是否存在
3. 確認已安裝 `@radix-ui/react-dialog`

### 問題：表單驗證不工作

**解決方案**：
1. 確認已安裝 `react-hook-form` 和 `@hookform/resolvers`
2. 確認已安裝 `zod`
3. 檢查 `EditCategoryDialog.tsx` 中的 import 路徑

### 問題：刪除後數據不更新

**解決方案**：
1. 確認 Server Action 中調用了 `revalidatePath('/dashboard/categories')`
2. 確認 Client Component 中調用了 `router.refresh()`
3. 檢查瀏覽器控制台是否有錯誤

### 問題：級聯刪除不工作

**解決方案**：
1. 確認 `deleteCategory` Server Action 已更新為支持級聯刪除
2. 檢查 Supabase 數據庫的 `ON DELETE CASCADE` 設置
3. 確認遞迴刪除邏輯正確

---

## 📝 技術細節

### 狀態管理

- 使用 React `useState` 管理對話框開關狀態
- 使用 `useTransition` 處理異步操作（Server Actions）
- 使用 `useRouter` 刷新 Server Component 數據

### 表單驗證

- 使用 React Hook Form 管理表單狀態
- 使用 Zod Schema 進行驗證
- 使用 `@hookform/resolvers/zod` 整合

### 級聯刪除

- Server Action 中實現遞迴刪除邏輯
- 先刪除所有子節點，再刪除父節點
- 前端顯示警告，告知用戶將刪除的子節點數量

### 事件處理

- 使用 `e.stopPropagation()` 防止事件冒泡
- 對話框點擊事件不會觸發節點選擇
- 拖拽和點擊操作互不干擾

---

## 🚀 下一步開發

### TODO

- [ ] 添加批量操作功能（批量刪除、批量移動）
- [ ] 添加搜索/過濾功能
- [ ] 添加鍵盤快捷鍵支持
- [ ] 添加拖拽時的視覺指示器（顯示可放置位置）
- [ ] 優化大數據量性能（虛擬滾動）
- [ ] 添加操作歷史記錄（Undo/Redo）

---

## 📚 參考文檔

- [React Hook Form 文檔](https://react-hook-form.com/)
- [Zod 文檔](https://zod.dev/)
- [Shadcn/UI 文檔](https://ui.shadcn.com/)
- [Radix UI 文檔](https://www.radix-ui.com/)
