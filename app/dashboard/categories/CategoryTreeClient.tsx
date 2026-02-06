/**
 * CategoryTreeClient - 客戶端組件
 * 
 * 處理：
 * - 拖拽交互
 * - 編輯/刪除操作
 * - 與 Server Actions 通信
 */

'use client';

import { useState, useTransition } from 'react';
import { TreeNode } from '@/lib/types/category';
import { SortableTree } from '@/components/category/SortableTree';
import { updateCategoryOrder, deleteCategory } from '@/app/actions/categories';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CategoryTreeClientProps {
  initialData: TreeNode[];
}

export function CategoryTreeClient({ initialData }: CategoryTreeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<TreeNode[]>(initialData);
  
  const handleNodeMove = async (
    activeId: string,
    overId: string | null,
    position: 'before' | 'after' | 'inside'
  ) => {
    startTransition(async () => {
      try {
        await updateCategoryOrder(activeId, overId, position);
        // 重新獲取數據
        router.refresh();
      } catch (error) {
        console.error('Failed to move node:', error);
        // TODO: 顯示錯誤提示
      }
    });
  };
  
  const handleNodeEdit = (id: string) => {
    // TODO: 打開編輯對話框
    console.log('Edit node:', id);
  };
  
  const handleNodeDelete = async (id: string) => {
    if (!confirm('確定要刪除此分類嗎？')) {
      return;
    }
    
    startTransition(async () => {
      try {
        await deleteCategory(id);
        // 重新獲取數據
        router.refresh();
      } catch (error) {
        console.error('Failed to delete node:', error);
        // TODO: 顯示錯誤提示
        if (error instanceof Error) {
          alert(error.message);
        }
      }
    });
  };
  
  const handleAddCategory = () => {
    // TODO: 打開創建對話框
    console.log('Add new category');
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddCategory} disabled={isPending}>
          <Plus className="w-4 h-4 mr-2" />
          新增分類
        </Button>
      </div>
      
      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>還沒有分類，點擊「新增分類」開始建立</p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-card">
          <SortableTree
            data={data}
            onNodeMove={handleNodeMove}
            onNodeEdit={handleNodeEdit}
            onNodeDelete={handleNodeDelete}
          />
        </div>
      )}
      
      {isPending && (
        <div className="text-sm text-muted-foreground text-center">
          更新中...
        </div>
      )}
    </div>
  );
}
