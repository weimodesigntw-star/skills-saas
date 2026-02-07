/**
 * AI Category Generation API Route
 * 
 * 使用 Google Gemini 模型進行串流生成分類結構
 * 優化使用 gemini-1.5-flash-latest 以獲得最佳速度
 * 
 * 包含用戶配額檢查：
 * - Free 用戶：每日限制 FREE_DAILY_LIMIT 次
 * - Pro 用戶：無限制
 */

import { google } from '@ai-sdk/google';
import { streamObject } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { checkAiLimit, incrementAiUsage } from '@/app/actions/subscription';
import { FREE_DAILY_LIMIT } from '@/lib/config/subscription';

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

    console.log('[AI Generate] Received request with topic:', topic);

    if (!topic || typeof topic !== 'string') {
      console.error('[AI Generate] Invalid topic:', topic);
      return new Response(
        JSON.stringify({ error: '請提供有效的主題' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 1. 檢查用戶配額（在呼叫 AI 之前）
    // ============================================
    const quotaCheck = await checkAiLimit();
    
    if (!quotaCheck.allowed) {
      console.log('[AI Generate] Quota limit reached', quotaCheck);
      
      // 使用配置檔案中的常量，確保一致性
      const limit = quotaCheck.limit ?? FREE_DAILY_LIMIT;
      
      const resetDateStr = quotaCheck.resetDate 
        ? new Date(quotaCheck.resetDate).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '明天';
      
      return new Response(
        JSON.stringify({ 
          error: '您已達到今日免費額度',
          message: `免費方案每日限制 ${limit} 次 AI 生成。請於 ${resetDateStr} 再試，或升級至 Pro 方案以獲得無限制使用。`,
          quota: {
            remaining: quotaCheck.remaining ?? 0,
            limit: limit,
            resetDate: quotaCheck.resetDate,
            tier: quotaCheck.tier ?? 'free',
          },
        }),
        { 
          status: 403, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('[AI Generate] Quota check passed', {
      remaining: quotaCheck.remaining,
      limit: quotaCheck.limit,
      tier: quotaCheck.tier,
    });

    // ============================================
    // 2. 檢查是否有 Google AI API Key
    // ============================================
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      console.error('[AI Generate] Google AI API Key not found');
      return new Response(
        JSON.stringify({ 
          error: 'Google AI API Key 未設定',
          message: '請在 .env.local 檔案中設定 GOOGLE_GENERATIVE_AI_API_KEY'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // 3. 呼叫 Google Gemini 進行串流生成
    // ============================================
    // 使用 Gemini Flash 模型（速度最快）
    // 注意：@ai-sdk/google 不需要 'models/' 前缀，直接使用模型名称即可
    // gemini-1.5-flash 在 v1beta API 中可能已弃用，改用 gemini-2.5-flash（稳定版本）
    // 如果需要更高品質，可以改用 'gemini-2.5-pro'
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
    console.log('[AI Generate] Using Google AI model:', modelName);

    // 使用 streamObject 進行串流生成
    // experimental_useObject 期望使用 streamObject + toTextStreamResponse
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

    console.log('[AI Generate] Stream started successfully');
    
    // ============================================
    // 4. 增加 AI 使用次數（在生成成功後）
    // ============================================
    // 注意：這裡我們在返回流之前就增加計數
    // 因為流式響應無法在完成後再執行操作
    // 如果生成失敗，我們可以考慮回滾，但為了簡化，這裡先不處理
    const incrementResult = await incrementAiUsage();
    
    if (!incrementResult.success) {
      console.error('[AI Generate] Failed to increment usage:', incrementResult.error);
      // 即使增加計數失敗，我們仍然返回生成的結果
      // 因為用戶已經通過了配額檢查
    }
    
    // 使用 toTextStreamResponse() 返回正確格式的數據流
    // 這會自動處理 experimental_useObject 期望的數據流格式
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[AI Generate] Error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    
    return new Response(
      JSON.stringify({ 
        error: '生成分類時發生錯誤',
        message: errorMessage,
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
