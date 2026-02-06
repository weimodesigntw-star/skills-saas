/**
 * useAIGenerate - AI 生成分類描述 Hook
 * 
 * 用於在表單中調用 AI 生成分類描述
 * 處理 Loading 狀態與錯誤回調
 */

import { useState } from 'react';

interface UseAIGenerateOptions {
  onSuccess?: (result: string) => void;
  onError?: (error: Error) => void;
}

interface UseAIGenerateReturn {
  generate: (categoryName: string, parentCategory?: string) => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * AI 生成分類描述 Hook
 * 
 * @example
 * const { generate, isLoading, error } = useAIGenerate({
 *   onSuccess: (description) => {
 *     setValue('description', description);
 *   },
 *   onError: (error) => {
 *     console.error('AI generation failed:', error);
 *   },
 * });
 * 
 * await generate('男裝', '服飾');
 */
export function useAIGenerate(
  options: UseAIGenerateOptions = {}
): UseAIGenerateReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = async (categoryName: string, parentCategory?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/categories/ai-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryName,
          parentCategory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();

      if (!data.description) {
        throw new Error('AI generation failed: No description returned');
      }

      options.onSuccess?.(data.description);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options.onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generate,
    isLoading,
    error,
  };
}
