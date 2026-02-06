/**
 * DeleteAlert - 刪除分類確認對話框
 * 
 * 使用 AlertDialog 警告用戶：
 * - 刪除父節點會連同刪除所有子節點（Cascade Delete）
 * - 此操作無法復原
 */

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteCategory } from '@/app/actions/categories';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TreeNode } from '@/lib/types/category';

interface DeleteAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: TreeNode | null;
}

/**
 * 計算子節點數量（遞迴）
 */
function countDescendants(node: TreeNode): number {
  if (!node.children || node.children.length === 0) {
    return 0;
  }
  
  let count = node.children.length;
  node.children.forEach(child => {
    count += countDescendants(child);
  });
  
  return count;
}

export function DeleteAlert({
  open,
  onOpenChange,
  category,
}: DeleteAlertProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  if (!category) return null;
  
  const hasChildren = category.children && category.children.length > 0;
  const descendantCount = hasChildren ? countDescendants(category) : 0;

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteCategory(category.id);
        onOpenChange(false);
        router.refresh(); // 刷新 Server Component 數據
      } catch (error) {
        console.error('Failed to delete category:', error);
        if (error instanceof Error) {
          alert(error.message);
        }
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>確認刪除分類</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              您確定要刪除分類 <strong>「{category.name}」</strong> 嗎？
            </p>
            {hasChildren && (
              <div className="rounded-md bg-destructive/10 p-3 text-destructive">
                <p className="font-medium">⚠️ 警告：此操作會連同刪除所有子分類</p>
                <p className="text-sm mt-1">
                  將刪除 <strong>{descendantCount} 個</strong> 子分類，此操作無法復原。
                </p>
              </div>
            )}
            {!hasChildren && (
              <p className="text-muted-foreground">
                此操作無法復原。
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? '刪除中...' : '確認刪除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
