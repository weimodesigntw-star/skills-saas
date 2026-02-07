/**
 * EditCategoryDialog - 編輯分類對話框
 * 
 * 使用 Dialog + Form (React Hook Form + Zod) 驗證
 */

'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { Sparkles, RotateCcw, Loader2 } from 'lucide-react';
import { updateCategory, createCategory } from '@/app/actions/categories';
import { useAIGenerate } from '@/lib/hooks/useAIGenerate';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Zod Schema
const categoryFormSchema = z.object({
  name: z.string().min(1, '名稱不能為空').max(50, '名稱不能超過 50 個字元'),
  description: z.string().max(200, '描述不能超過 200 個字元').optional().or(z.literal('')),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface EditCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string | null; // null 表示新增子分類
  parentId: string | null; // 父分類 ID（新增子分類時使用）
  initialName?: string;
  initialDescription?: string | null;
}

export function EditCategoryDialog({
  open,
  onOpenChange,
  categoryId,
  parentId,
  initialName = '',
  initialDescription = null,
}: EditCategoryDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [previousDescription, setPreviousDescription] = useState<string>('');
  const isEditMode = categoryId !== null;
  const isAddRootCategory = categoryId === null && parentId === null;
  const isAddSubCategory = categoryId === null && parentId !== null;

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: initialName,
      description: initialDescription || '',
    },
  });

  // AI 生成 Hook
  const { generate: generateDescription, isLoading: isAIGenerating, error: aiError } = useAIGenerate({
    onSuccess: (description) => {
      // 保存當前描述以便撤銷
      const currentDescription = form.getValues('description');
      setPreviousDescription(currentDescription || '');
      
      // 設置 AI 生成的描述
      form.setValue('description', description, { shouldValidate: true });
    },
    onError: (error) => {
      console.error('AI generation failed:', error);
      form.setError('root', { message: `AI 生成失敗：${error.message}` });
    },
  });

  // 當對話框打開時，重置表單
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        name: initialName,
        description: initialDescription || '',
      });
      setPreviousDescription(initialDescription || '');
    }
    onOpenChange(newOpen);
  };

  // 處理 AI 生成
  const handleAIGenerate = () => {
    const categoryName = form.getValues('name');
    if (!categoryName) {
      form.setError('name', { message: '請先輸入分類名稱' });
      return;
    }
    
    // TODO: 獲取父分類名稱（如果需要）
    // 目前先傳遞 undefined，未來可以從 parentId 查詢
    generateDescription(categoryName);
  };

  // 撤銷 AI 生成
  const handleUndo = () => {
    form.setValue('description', previousDescription, { shouldValidate: true });
    setPreviousDescription('');
  };

  const onSubmit = async (values: CategoryFormValues) => {
    startTransition(async () => {
      try {
        if (isEditMode && categoryId) {
          // 編輯模式
          await updateCategory(categoryId, values.name, values.description || null);
        } else {
          // 新增子分類模式
          await createCategory(values.name, values.description || null, parentId);
        }
        
        form.reset();
        onOpenChange(false);
        // 刷新 Server Component 數據
        router.refresh();
      } catch (error) {
        console.error('Failed to save category:', error);
        if (error instanceof Error) {
          form.setError('root', { message: error.message });
        }
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {isEditMode 
              ? '編輯分類' 
              : isAddRootCategory 
                ? '新增分類' 
                : '新增子分類'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? '修改分類名稱和描述'
              : isAddRootCategory
                ? '創建一個新的根分類'
                : '為此分類新增一個子分類'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名稱 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="輸入分類名稱"
                      {...field}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>描述</FormLabel>
                    <div className="flex items-center gap-2">
                      {previousDescription && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleUndo}
                          className="h-7 text-xs"
                          disabled={isPending || isAIGenerating}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          復原
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAIGenerate}
                        disabled={isPending || isAIGenerating || !form.watch('name')}
                        className="h-7 text-xs"
                      >
                        {isAIGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            生成中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI 潤飾
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        placeholder="輸入分類描述（選填）或點擊「AI 潤飾」自動生成"
                        {...field}
                        disabled={isPending || isAIGenerating}
                        rows={3}
                        className={cn(
                          isAIGenerating && 'opacity-60'
                        )}
                      />
                      {isAIGenerating && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    可選的分類描述，幫助識別此分類的用途。點擊「✨ AI 潤飾」可自動生成專業描述。
                  </FormDescription>
                  <FormMessage />
                  {aiError && (
                    <p className="text-sm text-destructive mt-1">
                      {aiError.message}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '儲存中...' : '儲存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
