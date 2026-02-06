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
