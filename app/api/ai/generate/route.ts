/**
 * AI Category Generation API Route
 *
 * 使用 Google Gemini 模型進行串流生成分類結構
 *
 * 包含用戶配額檢查：
 * - Free 用戶：每日限制 FREE_DAILY_LIMIT 次
 * - Pro 用戶：無限制
 */

import { google } from '@ai-sdk/google';
import { streamObject } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { checkAndConsumeAiQuota } from '@/app/actions/subscription';
import { FREE_DAILY_LIMIT } from '@/lib/config/subscription';
import { logger } from '@/lib/logger';

// 定義資料結構
const CategorySchema = z.object({
  name: z.string().describe('分類名稱（繁體中文）'),
  description: z.string().optional().describe('分類描述（選填）'),
  subcategories: z.array(
    z.object({
      name: z.string().describe('子分類名稱（繁體中文）'),
      description: z.string().optional().describe('子分類描述（選填）'),
    })
  ).optional().describe('子分類列表（選填）'),
});

const CategoriesResponseSchema = z.object({
  categories: z.array(CategorySchema).describe('分類列表'),
});

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic || typeof topic !== 'string') {
      return new Response(
        JSON.stringify({ error: '請提供有效的主題' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 1. 原子化配額檢查與消耗（防止競爭條件）
    const quotaCheck = await checkAndConsumeAiQuota();

    if (!quotaCheck.allowed) {
      logger.info('[AI Generate] Quota limit reached');
      return new Response(
        JSON.stringify({
          error: '您已達到今日免費額度',
          message: `免費方案每日限制 ${FREE_DAILY_LIMIT} 次 AI 生成。請明天再試，或升級至 Pro 方案以獲得無限制使用。`,
          quota: {
            remaining: quotaCheck.remaining ?? 0,
            limit: quotaCheck.limit ?? FREE_DAILY_LIMIT,
            tier: quotaCheck.tier ?? 'free',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    logger.info('[AI Generate] Quota passed, remaining:', quotaCheck.remaining);

    // 2. 檢查 Google AI API Key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      logger.error('[AI Generate] GOOGLE_GENERATIVE_AI_API_KEY not set');
      return new Response(
        JSON.stringify({
          error: 'Google AI API Key 未設定',
          message: '請在 .env.local 檔案中設定 GOOGLE_GENERATIVE_AI_API_KEY',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. 呼叫 Google Gemini 進行串流生成
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';

    const result = streamObject({
      model: google(modelName),
      schema: CategoriesResponseSchema,
      prompt: `你是一個分類專家。請為主題 "${topic}" 生成一個詳細的繁體中文分類樹。

請生成一個完整的分類樹，包含主分類和子分類。每個分類都應該有：
- 清晰的中文名稱
- 簡要的描述（可選）
- 相關的子分類（可選）

請確保分類結構合理且實用。`,
    });

    // 配額已在 checkAndConsumeAiQuota() 中原子化遞增，無需再次呼叫 incrementAiUsage()
    return result.toTextStreamResponse();
  } catch (error) {
    logger.error('[AI Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';

    return new Response(
      JSON.stringify({
        error: '生成分類時發生錯誤',
        message: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
