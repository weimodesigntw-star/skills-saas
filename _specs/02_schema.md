# 2. 數據模型與 Schema 定義

## 架構原則

### 技術棧
- **前端**: Next.js 14+ (App Router)
- **後端**: Supabase (PostgreSQL + Auth + Storage)
- **支付**: Stripe
- **AI**: Vercel AI SDK (預留接口)

### 數據策略
- **JSONB 優先**: 對於動態、非標準化的規格數據，使用 PostgreSQL JSONB
- **避免過度正規化**: 保持 schema 靈活，適應快速迭代
- **Runtime 驗證**: 使用 Zod Schema 確保 JSONB 數據的類型安全

---

## 1. 核心數據表 (Supabase Schema)

### 1.1 `profiles` (用戶擴展表)
```sql
-- Supabase Auth 自動管理 users 表
-- profiles 表擴展用戶信息

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  subscription_tier JSONB DEFAULT '{}'::jsonb, -- 動態訂閱配置
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX idx_profiles_subscription_status ON profiles(subscription_status);
```

### 1.2 `specifications` (規格主表)
```sql
-- 核心規格表，使用 JSONB 存儲動態規格數據

CREATE TABLE specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 基礎元數據
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 分類標籤，用於快速篩選
  status TEXT DEFAULT 'draft', -- 'draft', 'published', 'archived'
  
  -- JSONB 核心數據：動態規格結構
  spec_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- AI 輔助相關
  ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT, -- 記錄生成此規格的 AI 提示詞
  ai_model TEXT, -- 使用的 AI 模型版本
  
  -- 元數據
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb, -- 額外的元數據
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- 索引策略
CREATE INDEX idx_specifications_user_id ON specifications(user_id);
CREATE INDEX idx_specifications_category ON specifications(category);
CREATE INDEX idx_specifications_status ON specifications(status);
CREATE INDEX idx_specifications_created_at ON specifications(created_at DESC);

-- JSONB 索引：支持 GIN 索引用於複雜查詢
CREATE INDEX idx_specifications_spec_data_gin ON specifications USING GIN(spec_data);
CREATE INDEX idx_specifications_tags_gin ON specifications USING GIN(tags);

-- 全文搜索索引（如果需要）
CREATE INDEX idx_specifications_title_search ON specifications USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));
```

### 1.3 `spec_templates` (規格模板表)
```sql
-- 預定義的規格模板，用於快速創建

CREATE TABLE spec_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL 表示系統模板
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  -- 模板的 JSONB 結構定義
  template_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- 是否為公開模板
  is_public BOOLEAN DEFAULT FALSE,
  
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spec_templates_user_id ON spec_templates(user_id);
CREATE INDEX idx_spec_templates_public ON spec_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_spec_templates_category ON spec_templates(category);
```

### 1.4 `categories` (分類樹表)
```sql
-- 無限層級的分類樹結構
-- 使用 Adjacency List 模式（parent_id 自引用）

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
  USING (auth.uid() = user_id OR user_id IS NULL); -- NULL 表示系統分類
```

### 1.5 `ai_generation_logs` (AI 生成日誌)
```sql
-- 記錄 AI 輔助生成的歷史，用於優化和審計

CREATE TABLE ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  specification_id UUID REFERENCES specifications(id) ON DELETE SET NULL,
  
  -- 輸入
  input_type TEXT NOT NULL, -- 'text', 'image', 'mixed'
  input_text TEXT,
  input_image_url TEXT, -- Supabase Storage URL
  
  -- AI 配置
  model TEXT NOT NULL,
  prompt_template TEXT,
  temperature DECIMAL,
  
  -- 輸出
  output_json JSONB NOT NULL,
  raw_response JSONB, -- 完整的 AI 響應
  
  -- 元數據
  tokens_used INTEGER,
  cost_usd DECIMAL(10, 6),
  latency_ms INTEGER,
  
  -- 用戶反饋
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  user_feedback TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_logs_user_id ON ai_generation_logs(user_id);
CREATE INDEX idx_ai_logs_spec_id ON ai_generation_logs(specification_id);
CREATE INDEX idx_ai_logs_created_at ON ai_generation_logs(created_at DESC);
```

### 1.5 `subscriptions` (Stripe 訂閱記錄)
```sql
-- 與 Stripe 同步的訂閱記錄

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  
  status TEXT NOT NULL, -- 'active', 'canceled', 'past_due', etc.
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_sub_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

---

## 2. Zod Validation Schemas

### 2.1 核心規格 Schema (`lib/validations/spec.ts`)

```typescript
import { z } from 'zod';

// ============================================
// 基礎類型定義
// ============================================

/**
 * 規格項目的基礎結構
 * 支持多種數據類型：文本、數字、布爾值、選項、嵌套對象
 */
export const SpecFieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()), // 多選項
  z.record(z.unknown()), // 嵌套對象
]);

/**
 * 單個規格欄位定義
 */
export const SpecFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'boolean', 'select', 'multiselect', 'object', 'array']),
  value: SpecFieldValueSchema,
  required: z.boolean().default(false),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(), // 用於 select/multiselect
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

/**
 * 規格數據的完整結構
 * 這是一個動態結構，但必須符合此 schema
 */
export const SpecDataSchema = z.object({
  // 版本控制
  version: z.string().default('1.0.0'),
  
  // 規格欄位（動態結構）
  fields: z.record(z.string(), SpecFieldSchema),
  
  // 分類標籤
  tags: z.array(z.string()).optional(),
  
  // 自定義元數據
  metadata: z.record(z.unknown()).optional(),
}).strict();

/**
 * 規格創建/更新的完整 Schema
 */
export const SpecificationSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  spec_data: SpecDataSchema,
  tags: z.array(z.string()).max(20).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * 規格查詢參數 Schema
 */
export const SpecificationQuerySchema = z.object({
  category: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sort_by: z.enum(['created_at', 'updated_at', 'title']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// AI 生成相關 Schema
// ============================================

/**
 * AI 生成請求 Schema
 */
export const AIGenerationRequestSchema = z.object({
  input_type: z.enum(['text', 'image', 'mixed']),
  input_text: z.string().min(1).optional(),
  input_image_url: z.string().url().optional(),
  category: z.string().optional(),
  template_id: z.string().uuid().optional(),
  model: z.string().default('gpt-4'),
  temperature: z.number().min(0).max(2).default(0.7),
  custom_prompt: z.string().optional(),
}).refine(
  (data) => {
    if (data.input_type === 'text' && !data.input_text) return false;
    if (data.input_type === 'image' && !data.input_image_url) return false;
    if (data.input_type === 'mixed' && (!data.input_text || !data.input_image_url)) return false;
    return true;
  },
  { message: '輸入類型與輸入內容不匹配' }
);

/**
 * AI 生成響應 Schema
 */
export const AIGenerationResponseSchema = z.object({
  success: z.boolean(),
  spec_data: SpecDataSchema.optional(),
  raw_response: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  tokens_used: z.number().optional(),
  cost_usd: z.number().optional(),
});

// ============================================
// 模板相關 Schema
// ============================================

/**
 * 規格模板 Schema
 */
export const SpecTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
  template_schema: SpecDataSchema,
  is_public: z.boolean().default(false),
});

// ============================================
// TypeScript 類型導出
// ============================================

export type SpecFieldValue = z.infer<typeof SpecFieldValueSchema>;
export type SpecField = z.infer<typeof SpecFieldSchema>;
export type SpecData = z.infer<typeof SpecDataSchema>;
export type Specification = z.infer<typeof SpecificationSchema>;
export type SpecificationQuery = z.infer<typeof SpecificationQuerySchema>;
export type AIGenerationRequest = z.infer<typeof AIGenerationRequestSchema>;
export type AIGenerationResponse = z.infer<typeof AIGenerationResponseSchema>;
export type SpecTemplate = z.infer<typeof SpecTemplateSchema>;
```

---

## 3. API 路由設計 (Next.js App Router)

### 3.1 規格管理 API

```
app/api/specifications/
├── route.ts              # GET (列表), POST (創建)
├── [id]/
│   ├── route.ts          # GET (詳情), PATCH (更新), DELETE (刪除)
│   └── publish/
│       └── route.ts       # POST (發布規格)
└── ai/
    └── generate/
        └── route.ts       # POST (AI 輔助生成)
```

### 3.2 模板管理 API

```
app/api/templates/
├── route.ts              # GET (列表), POST (創建)
├── [id]/
│   └── route.ts          # GET (詳情), PATCH (更新), DELETE (刪除)
└── public/
    └── route.ts          # GET (公開模板列表)
```

### 3.3 AI 生成 API (預留接口)

```typescript
// app/api/specifications/ai/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { AIGenerationRequestSchema, AIGenerationResponseSchema } from '@/lib/validations/spec';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/specifications/ai/generate
 * 
 * AI 輔助生成規格
 * 
 * 未來將整合 Vercel AI SDK：
 * - 支持文本描述生成規格
 * - 支持圖片識別生成規格
 * - 支持混合輸入
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedInput = AIGenerationRequestSchema.parse(body);

    // TODO: 整合 Vercel AI SDK
    // const aiResponse = await generateSpecWithAI(validatedInput);
    
    // 臨時實現：返回結構化響應
    const response: AIGenerationResponse = {
      success: false,
      error: 'AI generation not yet implemented',
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 4. 前端組件結構 (預留)

### 4.1 Dashboard 頁面結構

```
app/dashboard/
├── page.tsx                    # 規格列表頁
├── specifications/
│   ├── page.tsx                # 規格列表
│   ├── new/
│   │   └── page.tsx            # 創建新規格
│   └── [id]/
│       ├── page.tsx            # 規格詳情/編輯
│       └── ai-assist/
│           └── page.tsx        # AI 輔助填寫頁面
├── templates/
│   └── page.tsx                # 模板管理
└── settings/
    └── page.tsx                # 用戶設置
```

### 4.2 AI 輔助組件 (預留)

```typescript
// components/specifications/AIAssistButton.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

interface AIAssistButtonProps {
  onGenerate: (input: { text?: string; imageUrl?: string }) => Promise<void>;
}

export function AIAssistButton({ onGenerate }: AIAssistButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    setIsGenerating(true);
    try {
      // TODO: 打開 AI 輸入對話框
      // 支持文本輸入或圖片上傳
      await onGenerate({ text: '示例輸入' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isGenerating}
      variant="outline"
      className="gap-2"
    >
      <Sparkles className="w-4 h-4" />
      {isGenerating ? '生成中...' : 'AI 輔助填寫'}
    </Button>
  );
}
```

---

## 5. 數據庫函數與觸發器

### 5.1 自動更新 `updated_at`

```sql
-- 創建更新時間觸發器函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為各表添加觸發器
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_specifications_updated_at
  BEFORE UPDATE ON specifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spec_templates_updated_at
  BEFORE UPDATE ON spec_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 5.2 Row Level Security (RLS) 策略

```sql
-- 啟用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE spec_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- profiles: 用戶只能查看和更新自己的資料
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- specifications: 用戶只能管理自己的規格
CREATE POLICY "Users can manage own specifications"
  ON specifications
  FOR ALL
  USING (auth.uid() = user_id);

-- spec_templates: 用戶可以查看公開模板和自己的模板
CREATE POLICY "Users can view public templates"
  ON spec_templates FOR SELECT
  USING (is_public = TRUE OR auth.uid() = user_id);

CREATE POLICY "Users can manage own templates"
  ON spec_templates
  FOR ALL
  USING (auth.uid() = user_id OR user_id IS NULL); -- 允許系統模板
```

---

## 6. 索引與性能優化

### 6.1 JSONB 查詢優化

```sql
-- 示例：查詢特定 JSONB 欄位的規格
-- 假設 spec_data.fields.status.value = 'active'

CREATE INDEX idx_specifications_status_value 
ON specifications USING GIN ((spec_data -> 'fields' -> 'status' -> 'value'));

-- 查詢示例
SELECT * FROM specifications
WHERE spec_data->'fields'->'status'->>'value' = 'active';
```

### 6.2 全文搜索優化

```sql
-- 如果需要更強大的搜索，考慮使用 pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_specifications_title_trgm 
ON specifications USING GIN (title gin_trgm_ops);
```

---

## 7. 遷移腳本示例

```sql
-- migrations/001_initial_schema.sql

-- 執行順序：
-- 1. 創建 profiles 表
-- 2. 創建 specifications 表
-- 3. 創建 spec_templates 表
-- 4. 創建 ai_generation_logs 表
-- 5. 創建 subscriptions 表
-- 6. 創建索引
-- 7. 創建觸發器
-- 8. 設置 RLS 策略

-- (具體 SQL 見上方各表定義)
```

---

## 8. 下一步行動

1. ✅ **Schema 定義完成** - 數據庫結構已規劃
2. ⏳ **Zod Schema 實作** - 創建 `lib/validations/spec.ts`
3. ⏳ **Supabase Migration** - 執行 SQL 遷移腳本
4. ⏳ **API Routes** - 實作 Next.js API 路由
5. ⏳ **AI SDK 整合** - 連接 Vercel AI SDK
6. ⏳ **前端組件** - 構建 Dashboard UI

---

## 附錄：JSONB 數據示例

### 示例 1: 簡單規格
```json
{
  "version": "1.0.0",
  "fields": {
    "name": {
      "key": "name",
      "label": "產品名稱",
      "type": "text",
      "value": "iPhone 15 Pro",
      "required": true
    },
    "price": {
      "key": "price",
      "label": "價格",
      "type": "number",
      "value": 35900,
      "required": true
    }
  },
  "tags": ["電子產品", "手機"],
  "metadata": {
    "source": "manual"
  }
}
```

### 示例 2: 複雜嵌套規格
```json
{
  "version": "1.0.0",
  "fields": {
    "product": {
      "key": "product",
      "label": "產品信息",
      "type": "object",
      "value": {
        "name": "MacBook Pro",
        "specs": {
          "cpu": "M3 Pro",
          "ram": "18GB",
          "storage": "512GB"
        }
      },
      "required": true
    },
    "categories": {
      "key": "categories",
      "label": "分類",
      "type": "multiselect",
      "value": ["筆記本電腦", "Apple", "專業級"],
      "options": ["筆記本電腦", "Apple", "專業級", "消費級"],
      "required": true
    }
  }
}
```
