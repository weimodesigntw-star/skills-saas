# 種子數據導入指南

## 概述

此專案包含 3 個預設產業的完整規格模板：
1. **服飾產業** - 服裝、配件等時尚產品
2. **3C 電子產品** - 手機、電腦、相機等
3. **傢俱產業** - 桌椅、沙發、床組等

## 方式一：使用 Supabase SQL Editor（推薦）

1. 打開 Supabase Dashboard
2. 進入 SQL Editor
3. 執行以下命令生成 SQL：

```bash
npx tsx prisma/seed.ts
```

4. 複製輸出的 SQL 語句
5. 在 SQL Editor 中執行

## 方式二：使用 TypeScript 腳本

```bash
# 安裝依賴（如果還沒有）
npm install

# 執行種子腳本
npx tsx prisma/seed.ts
```

腳本會輸出 SQL 語句，你可以複製到 Supabase SQL Editor 執行。

## 方式三：在應用中執行（開發環境）

```typescript
import { seedSupabase } from './prisma/seed';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

await seedSupabase(supabase);
```

## 驗證導入結果

執行以下 SQL 查詢驗證：

```sql
-- 查看所有公開模板
SELECT name, category, is_public 
FROM spec_templates 
WHERE is_public = true;

-- 應該看到 3 筆記錄：
-- 1. 服飾產品規格模板
-- 2. 3C 電子產品規格模板
-- 3. 傢俱產品規格模板
```

## 注意事項

- ⚠️ 種子數據會插入到 `spec_templates` 表
- ⚠️ 如果表已存在相同數據，可能會產生衝突
- ✅ 建議在開發環境或新專案中使用
- ✅ 生產環境請謹慎執行

## 下一步

導入完成後，你可以在應用中使用這些模板：
- 在 Dashboard 中查看模板列表
- 使用模板快速創建新規格
- 基於模板進行 AI 輔助生成
