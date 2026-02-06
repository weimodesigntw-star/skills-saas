# 安裝指南

## 前端依賴安裝

### 1. Tree View 組件（無限層級分類）

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2. UI 基礎庫（Shadcn/UI）

```bash
# 如果還沒有初始化 Shadcn/UI
npx shadcn-ui@latest init

# 安裝常用組件
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add form
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tree-view  # 如果有的話，或使用自定義實現
```

### 3. 表單與驗證

```bash
npm install react-hook-form @hookform/resolvers zod
```

### 4. 圖標庫

```bash
npm install lucide-react
```

## 完整依賴列表（package.json 參考）

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.0.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.0",
    "@hookform/resolvers": "^3.3.0",
    "@supabase/supabase-js": "^2.38.0",
    "lucide-react": "^0.294.0",
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.2.0",
    "tsx": "^4.7.0"
  }
}
```

## 環境變數設置

創建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 下一步

1. ✅ 安裝依賴
2. ✅ 設置環境變數
3. ✅ 執行種子數據導入（見 `SEED_GUIDE.md`）
4. ✅ 開始開發！
