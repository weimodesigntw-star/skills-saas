# 🛠️ Day 2 運維錦囊 (Maintenance Guide)

## 📋 維護原則 (Maintenance Principles)

### 規則 1: Schema 變更原則

**嚴禁修改** `002_complete_setup.sql` 中已定義的基礎 Schema。

**正確做法**：
- ✅ 創建新的 Migration 文件（例如：`003_add_new_column.sql`）
- ✅ 使用 `ALTER TABLE` 進行增量變更
- ✅ 記錄所有變更在 Migration 文件中

**錯誤做法**：
- ❌ 直接修改 `002_complete_setup.sql`
- ❌ 在生產環境直接執行 DDL 語句
- ❌ 不記錄變更歷史

### 規則 2: Mobile-First 原則

**任何 UI 修改必須保持觸控友善**。

**檢查清單**：
- [ ] 操作按鈕在移動端可見（不依賴 hover）
- [ ] 觸控目標大小 ≥ 44x44px
- [ ] 使用響應式設計（`md:` 斷點）
- [ ] 測試移動端體驗（瀏覽器開發者工具）

**參考實現**：
```tsx
// ✅ 正確：移動端永遠顯示，桌面端 hover 顯示
<div className="opacity-100 md:opacity-0 md:group-hover:opacity-100">
  <ActionMenu />
</div>
```

### 規則 3: 類型一致性原則

**修改 API 時，必須同步更新 Zod Schema**。

**工作流程**：
1. 修改 `lib/validations/spec.ts` 中的 Zod Schema
2. TypeScript 會自動推斷類型
3. 更新相關的 Type Definition
4. 確保前端和後端使用相同的類型

**檢查清單**：
- [ ] API 路由使用 Zod 驗證
- [ ] 前端表單使用相同的 Zod Schema
- [ ] TypeScript 類型從 Zod Schema 導出
- [ ] 沒有手動定義重複的類型

---

## 🔄 常見維護任務

### 任務 1: 新增數據庫欄位

**步驟**：

1. **創建 Migration 文件**
   ```sql
   -- supabase/migrations/003_add_new_field.sql
   ALTER TABLE categories 
   ADD COLUMN IF NOT EXISTS new_field TEXT;
   
   CREATE INDEX IF NOT EXISTS idx_categories_new_field 
   ON categories(new_field) WHERE new_field IS NOT NULL;
   ```

2. **更新 TypeScript 類型**
   ```typescript
   // lib/types/category.ts
   export interface Category {
     // ... 現有欄位
     new_field?: string; // 新增欄位
   }
   ```

3. **更新 Zod Schema**（如果需要驗證）
   ```typescript
   // lib/validations/spec.ts
   export const CategorySchema = z.object({
     // ... 現有欄位
     new_field: z.string().optional(),
   });
   ```

### 任務 2: 新增 API 端點

**步驟**：

1. **創建 API 路由**
   ```typescript
   // app/api/categories/[id]/route.ts
   import { z } from 'zod';
   import { CategorySchema } from '@/lib/validations/spec';
   
   export async function GET(request: Request) {
     const validated = CategorySchema.parse(await request.json());
     // ...
   }
   ```

2. **使用 Zod 驗證**
   - 所有輸入必須通過 Zod Schema 驗證
   - 錯誤處理統一格式

3. **更新文檔**
   - 記錄 API 端點用途
   - 提供使用範例

### 任務 3: 修改 UI 組件

**檢查清單**：

- [ ] 移動端測試通過
- [ ] 響應式設計正確
- [ ] 無障礙性（A11y）符合標準
- [ ] 使用 Shadcn/UI 組件（保持一致性）

---

## 🚨 故障排除 (Troubleshooting)

### 問題 1: 環境變數不生效

**症狀**：API 調用失敗，顯示 "Supabase URL not found"

**解決方案**：
```bash
# 1. 確認 .env.local 存在且格式正確
cat .env.local

# 2. 重啟開發伺服器
# Ctrl+C 停止
npm run dev

# 3. 確認環境變數已載入
# 在代碼中檢查
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

### 問題 2: 數據庫 Migration 失敗

**症狀**：SQL 執行錯誤

**解決方案**：
1. 檢查錯誤訊息
2. 確認是否有衝突的 Migration
3. 使用 `IF NOT EXISTS` 避免重複創建
4. 檢查 RLS 策略是否正確

### 問題 3: 類型錯誤

**症狀**：TypeScript 編譯錯誤

**解決方案**：
1. 確認 Zod Schema 已更新
2. 運行 `npx tsc --noEmit` 檢查類型
3. 確保所有類型從 Zod Schema 導出
4. 檢查 import 路徑是否正確

---

## 📝 Migration 管理最佳實踐

### 命名規範

```
supabase/migrations/
├── 001_initial_schema.sql          # 初始 Schema
├── 002_complete_setup.sql          # 完整設置（當前）
├── 003_add_new_field.sql           # 新增欄位
├── 004_add_index.sql                # 新增索引
└── 005_update_rls_policy.sql       # 更新 RLS 策略
```

### Migration 模板

```sql
-- Migration: 003_add_new_field
-- Description: 新增 new_field 欄位到 categories 表
-- Date: 2026-02-05
-- Author: Your Name

-- 1. 新增欄位
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS new_field TEXT;

-- 2. 新增索引（如果需要）
CREATE INDEX IF NOT EXISTS idx_categories_new_field 
ON categories(new_field) WHERE new_field IS NOT NULL;

-- 3. 更新現有數據（如果需要）
UPDATE categories 
SET new_field = 'default_value' 
WHERE new_field IS NULL;

-- 4. 驗證
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'categories' AND column_name = 'new_field';
```

---

## 🔍 代碼審查檢查清單

在提交代碼前，請確認：

### 數據庫變更
- [ ] 創建了新的 Migration 文件
- [ ] Migration 可以安全地重複執行（使用 `IF NOT EXISTS`）
- [ ] 更新了相關的 TypeScript 類型
- [ ] 更新了 Zod Schema（如果需要）

### UI 變更
- [ ] 移動端測試通過
- [ ] 響應式設計正確
- [ ] 使用 Shadcn/UI 組件
- [ ] 無障礙性符合標準

### API 變更
- [ ] 使用 Zod 驗證輸入
- [ ] 錯誤處理統一格式
- [ ] 更新了 API 文檔
- [ ] 測試了所有端點

### 類型安全
- [ ] 所有類型從 Zod Schema 導出
- [ ] 沒有手動定義重複類型
- [ ] TypeScript 編譯無錯誤
- [ ] 類型定義與數據庫 Schema 一致

---

## 📚 參考資源

- `LAST_MILE_CHECKLIST.md` - 初始設置清單
- `FINAL_TESTING_GUIDE.md` - 測試指南
- `CODE_REVIEW_FIXES.md` - Code Review 修正記錄
- `_specs/02_schema.md` - 數據庫 Schema 文檔

---

## 🎯 維護者 Prompt (保存到 Cursor Snippets)

```
Role: Lead Maintainer

我們已經有一個運作完美的 Next.js + Supabase + Shadcn 系統。

規則：
1. 嚴禁修改 002_complete_setup.sql 中已定義的基礎 Schema，只能新增 Migration 檔案。
2. 任何 UI 修改，必須保持 Mobile-First (觸控友善)。
3. 修改 API 時，必須同步更新 lib/validations/spec.ts (Zod)，保持前後端類型一致。

請根據以上規則進行代碼審查和修改。
```

---

**維護愉快！🛠️**
