/**
 * POST /api/categories/ai-description
 * 
 * AI 生成分類描述
 * 
 * 使用 Google Gemini 模型生成專業的分類描述
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { logger } from '@/lib/logger';

const requestSchema = z.object({
  categoryName: z.string().min(1),
  parentCategory: z.string().optional(),
  parentChain: z.string().optional(), // 完整父層路徑，例：「電子產品 > 手機」
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryName, parentCategory, parentChain: chain } = requestSchema.parse(body);
    const parentChain = chain ?? parentCategory;

    // 檢查 Google AI API Key
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      logger.error('[AI Description] GOOGLE_GENERATIVE_AI_API_KEY not set');
      return NextResponse.json(
        { 
          error: 'Google AI API Key 未設定',
          message: '請在 .env.local 檔案中設定 GOOGLE_GENERATIVE_AI_API_KEY',
        },
        { status: 500 }
      );
    }

    // 使用 Google Gemini 生成描述
    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash';
    
    const fullPath = parentChain ? `${parentChain} > ${categoryName}` : categoryName;
    const pathContext = parentChain
      ? `完整路徑：${fullPath}。請描述此分類的商品範圍，`
      : '';

    const { text } = await generateText({
      model: google(modelName),
      prompt: `你是電商平台的分類專家。請為分類「${fullPath}」生成一段繁體中文描述。${pathContext}

要求：
- 描述長度：約 50 字
- 語言：繁體中文
- 風格：專業、簡潔
- 內容：描述此分類的商品範圍與定位

請只返回描述文字，不要其他內容或標點符號。`,
      temperature: 0.7,
    });

    logger.info('[AI Description] Generated description for:', categoryName);

    return NextResponse.json({ 
      description: text.trim(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error('[AI Description] Validation error:', error.errors);
      return NextResponse.json(
        { 
          error: 'Invalid request', 
          details: error.errors,
          message: '請求參數驗證失敗，請檢查輸入格式',
        },
        { status: 400 }
      );
    }
    
    logger.error('[AI Description] Generation error:', error);
    const errorMessage = error instanceof Error ? error.message : '未知錯誤';
    
    return NextResponse.json(
      { 
        error: '生成描述時發生錯誤',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
