/**
 * AI Category Generator Component
 * 
 * 使用 AI SDK 的串流功能即時生成分類結構
 */

'use client';

import { useState, useEffect } from 'react';
import { experimental_useObject } from '@ai-sdk/react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { createCategory } from '@/app/actions/categories';
import { checkAiLimit } from '@/app/actions/subscription';
import { useRouter } from 'next/navigation';

// 定義分類結構的 Zod Schema（與 API 一致）
const CategorySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  subcategories: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
    })
  ).optional(),
});

const CategoriesResponseSchema = z.object({
  categories: z.array(CategorySchema),
});

type Category = z.infer<typeof CategorySchema>;

export function AiCategoryGenerator() {
  const router = useRouter();
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  // 選中的分類索引（使用 Set 存儲主分類的索引）
  const [selectedCategories, setSelectedCategories] = useState<Set<number>>(new Set());
  // 配額狀態
  const [quota, setQuota] = useState<{
    remaining: number;
    limit: number;
    tier: string;
    allowed: boolean;
  } | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(true);

  // 獲取配額信息
  const fetchQuota = async () => {
    try {
      setIsLoadingQuota(true);
      const quotaInfo = await checkAiLimit();
      if (quotaInfo) {
        setQuota({
          remaining: quotaInfo.remaining ?? 0,
          limit: quotaInfo.limit ?? 3,
          tier: quotaInfo.tier ?? 'free',
          allowed: quotaInfo.allowed ?? false,
        });
      }
    } catch (err) {
      console.error('Failed to fetch quota:', err);
    } finally {
      setIsLoadingQuota(false);
    }
  };

  // 組件加載時獲取配額
  useEffect(() => {
    fetchQuota();
  }, []);

  const { object, submit, isLoading, error: hookError, clear } = experimental_useObject({
    api: '/api/ai/generate',
    schema: CategoriesResponseSchema,
    onFinish: async () => {
      setIsGenerating(false);
      setError(null);
      // 生成完成後，自動選中所有分類
      if (object?.categories && object.categories.length > 0) {
        setSelectedCategories(new Set(object.categories.map((_, index) => index)));
      }
      // 重新獲取配額以確保同步（API 已經自動增加了計數）
      await fetchQuota();
    },
    onError: (error) => {
      console.error('AI generation error:', error);
      setIsGenerating(false);
      
      // 檢查是否為配額限制錯誤
      if (error.message?.includes('免費額度') || error.message?.includes('已達到')) {
        setError(error.message);
        // 更新配額狀態為已達限制
        setQuota(prev => prev ? {
          ...prev,
          remaining: 0,
          allowed: false,
        } : null);
      } else {
        setError(error.message || '生成分類時發生錯誤，請檢查 Google AI API Key 是否已設定');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      return;
    }

    setError(null);
    setIsGenerating(true);
    
    try {
      await submit({ topic: topic.trim() });
    } catch (err) {
      console.error('Submit error:', err);
      setIsGenerating(false);
      setError(err instanceof Error ? err.message : '提交請求時發生錯誤');
    }
  };

  // 切換分類選中狀態
  const toggleCategory = (index: number) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (!object?.categories) return;
    
    if (selectedCategories.size === object.categories.length) {
      // 取消全選
      setSelectedCategories(new Set());
    } else {
      // 全選
      setSelectedCategories(new Set(object.categories.map((_, index) => index)));
    }
  };

  const handleUseCategories = async () => {
    if (!object?.categories || object.categories.length === 0) {
      setError('沒有可導入的分類');
      return;
    }

    // 檢查是否有選中的分類
    if (selectedCategories.size === 0) {
      setError('請至少選擇一個分類');
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportSuccess(false);
    
    // 計算選中分類的總數（主分類 + 所有子分類）
    const selectedCategoriesArray = Array.from(selectedCategories);
    const totalCategories = selectedCategoriesArray.reduce((sum, index) => {
      const category = object.categories[index];
      return sum + 1 + (category.subcategories?.length || 0);
    }, 0);
    setImportProgress({ current: 0, total: totalCategories });

    try {
      // 只創建選中的主分類
      let importedCount = 0;
      
      for (const index of selectedCategoriesArray) {
        const category = object.categories[index];
        const createdCategory = await createCategory(
          category.name,
          category.description || null,
          null // 主分類的 parent_id 為 null
        );
        importedCount++;
        setImportProgress({ current: importedCount, total: totalCategories });

        // 如果有子分類，創建它們
        if (category.subcategories && category.subcategories.length > 0) {
          for (const subcategory of category.subcategories) {
            await createCategory(
              subcategory.name,
              subcategory.description || null,
              createdCategory.id // 子分類的 parent_id 為主分類的 id
            );
            importedCount++;
            setImportProgress({ current: importedCount, total: totalCategories });
          }
        }
      }

      setImportSuccess(true);
      setIsImporting(false); // 立即清除導入狀態
      
      // 立即刷新頁面以顯示新分類
      router.refresh();
      
      // 2 秒後清除生成結果
      setTimeout(() => {
        setTopic('');
        setIsGenerating(false);
        setImportSuccess(false);
        setSelectedCategories(new Set());
      }, 2000);
    } catch (err) {
      console.error('導入分類錯誤:', err);
      setError(err instanceof Error ? err.message : '導入分類時發生錯誤');
      setIsImporting(false);
    }
  };

  return (
    <div className="mb-6 space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI 分類生成器
          </CardTitle>
          <CardDescription>
            輸入主題，讓 AI 為您自動生成完整的分類結構
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 輸入區域 */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="例如：電子產品、服飾、傢俱..."
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setError(null); // 清除錯誤當用戶輸入時
                }}
                disabled={isLoading || isGenerating}
                className="flex-1"
              />
              <Button 
                type="submit" 
                disabled={isLoading || isGenerating || !topic.trim() || (quota && !quota.allowed && quota.tier !== 'pro')}
                className="min-w-[100px]"
              >
                {isLoading || isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成
                  </>
                )}
              </Button>
            </div>
            
            {/* 用量顯示器 */}
            {!isLoadingQuota && quota && (
              <div className="flex items-center gap-2">
                {quota.tier === 'pro' ? (
                  <Badge variant="gold" className="text-xs">
                    ✨ Pro 無限用量
                  </Badge>
                ) : quota.remaining === 0 ? (
                  <Badge variant="destructive" className="text-xs">
                    今日額度已滿
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    今日剩餘：{quota.remaining} / {quota.limit}
                  </Badge>
                )}
              </div>
            )}
          </form>

          {/* 錯誤提示 */}
          {(error || hookError) && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-destructive mb-1">生成失敗</h4>
                  <p className="text-sm text-destructive/80">
                    {error || hookError?.message || '生成分類時發生錯誤'}
                  </p>
                  {(!process.env.NEXT_PUBLIC_VERCEL || process.env.NODE_ENV === 'development') && (
                    <p className="text-xs text-muted-foreground mt-2">
                      提示：請確認已在 .env.local 中設定 GOOGLE_GENERATIVE_AI_API_KEY
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 生成結果區域 */}
          {(isLoading || isGenerating || object?.categories) && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">生成結果</CardTitle>
                {isLoading || isGenerating ? (
                  <CardDescription>
                    AI 正在生成分類結構...
                  </CardDescription>
                ) : (
                  <CardDescription>
                    已生成 {object?.categories?.length || 0} 個分類
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {isLoading || isGenerating ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">
                      正在生成分類結構...
                    </span>
                  </div>
                ) : (
                  object?.categories && object.categories.length > 0 && (
                    <div className="space-y-4">
                      {/* 全選/取消全選按鈕 */}
                      <div className="flex items-center justify-between pb-2 border-b">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCategories.size === object.categories.length && object.categories.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">
                            {selectedCategories.size === object.categories.length 
                              ? '取消全選' 
                              : '全選'}
                          </span>
                        </label>
                        <span className="text-sm text-muted-foreground">
                          已選擇 {selectedCategories.size} / {object.categories.length} 個分類
                        </span>
                      </div>

                      <div className="space-y-3">
                        {object.categories.map((category: Category, index: number) => {
                          const isSelected = selectedCategories.has(index);
                          return (
                            <Card 
                              key={index} 
                              className={`border-l-4 ${isSelected ? 'border-l-primary bg-primary/5' : 'border-l-muted'}`}
                            >
                              <CardContent className="pt-4">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-3">
                                    <label className="flex items-start gap-3 cursor-pointer flex-1">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleCategory(index)}
                                        className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                      />
                                      <div className="flex-1">
                                        <h4 className="font-semibold text-lg">
                                          {category.name}
                                        </h4>
                                        {category.description && (
                                          <p className="text-sm text-muted-foreground mt-1">
                                            {category.description}
                                          </p>
                                        )}
                                      </div>
                                    </label>
                                  </div>
                                
                                {/* 子分類 */}
                                {category.subcategories && category.subcategories.length > 0 && (
                                  <div className="mt-3 ml-4 space-y-2 border-l-2 border-l-muted pl-4">
                                    {category.subcategories.map((sub, subIndex) => (
                                      <div key={subIndex} className="py-1">
                                        <div className="font-medium text-sm">
                                          {sub.name}
                                        </div>
                                        {sub.description && (
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            {sub.description}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                      
                      {/* 導入成功提示 */}
                      {importSuccess && (
                        <div className="rounded-md bg-green-50 border border-green-200 p-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <p className="text-sm text-green-800 font-medium">
                              分類已成功導入！正在刷新頁面...
                            </p>
                          </div>
                        </div>
                      )}

                      {/* 操作按鈕 */}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={handleUseCategories}
                          disabled={isImporting || importSuccess || selectedCategories.size === 0}
                          className="flex-1"
                          variant="default"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              {importProgress.total > 0 
                                ? `導入中... (${importProgress.current}/${importProgress.total})`
                                : '導入中...'}
                            </>
                          ) : importSuccess ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              已導入
                            </>
                          ) : (
                            `導入選中的分類 (${selectedCategories.size})`
                          )}
                        </Button>
                        <Button 
                          onClick={async () => {
                            // 清除所有狀態
                            setTopic('');
                            setIsGenerating(false);
                            setImportSuccess(false);
                            setImportProgress({ current: 0, total: 0 });
                            setError(null);
                            setSelectedCategories(new Set());
                            // 清除 AI 生成的對象數據
                            clear();
                            // 重新獲取配額（以防配額有變化）
                            await fetchQuota();
                          }}
                          disabled={isImporting}
                          variant="outline"
                        >
                          清除
                        </Button>
                      </div>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
