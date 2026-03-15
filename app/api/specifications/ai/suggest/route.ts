/**
 * POST /api/specifications/ai/suggest
 *
 * 依商品名稱與分類，用 Gemini 生成規格建議
 * Request: { productName, categoryName?, existingSpecs?: string[] }
 * Response: { specs: [{ name: string, options: string[] }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const requestSchema = z.object({
  productName: z.string().min(1),
  categoryName: z.string().optional(),
  existingSpecs: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, categoryName = '', existingSpecs = [] } = requestSchema.parse(body);

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google AI API Key 未設定' },
        { status: 500 }
      );
    }

    const existingHint =
      existingSpecs.length > 0
        ? `\n目前已有的規格名稱請勿重複：${existingSpecs.join('、')}。`
        : '';

    const prompt = `你是商品規格專家。商品名稱：${productName}${categoryName ? `，分類：${categoryName}` : ''}。${existingHint}

請建議 3～5 組規格，每組包含「名稱」與「可選值」陣列。
只回傳一個 JSON 陣列，不要其他說明。格式嚴格如下：
[{"name":"規格名稱","options":["選項1","選項2"]}]

範例：[{"name":"顏色","options":["紅","藍","黑"]},{"name":"尺寸","options":["S","M","L"]}]`;

    const modelName = process.env.GOOGLE_AI_MODEL || 'gemini-2.0-flash-exp';
    const { text } = await generateText({
      model: google(modelName),
      prompt,
      temperature: 0.5,
    });

    const trimmed = text.trim().replace(/^```json?\s*|\s*```$/g, '');
    const parsed = JSON.parse(trimmed) as { name: string; options: string[] }[];
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: 'AI 回傳格式錯誤' }, { status: 500 });
    }
    const specs = parsed.map((s) => ({
      name: String(s.name ?? ''),
      options: Array.isArray(s.options) ? s.options.map(String) : [],
    }));

    return NextResponse.json({ specs });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: '參數錯誤', details: e.errors }, { status: 400 });
    }
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'AI 回傳非 JSON' }, { status: 500 });
    }
    console.error('[spec/ai/suggest]', e);
    const msg = e instanceof Error ? e.message : '未知錯誤';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
