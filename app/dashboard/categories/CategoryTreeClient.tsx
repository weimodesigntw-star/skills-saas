/**
 * CategoryTreeClient - 客戶端組件
 * 
 * 處理：
 * - 拖拽交互
 * - 編輯/刪除操作
 * - 與 Server Actions 通信
 */

'use client';

import { useState, useTransition, useEffect } from 'react';
import { TreeNode } from '@/lib/types/category';
import { SortableTree } from '@/components/category/SortableTree';
import { EditCategoryDialog } from '@/components/category/EditCategoryDialog';
import { updateCategoryOrder, deleteCategory, getCategories } from '@/app/actions/categories';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Loader2 } from 'lucide-react';

interface CategoryTreeClientProps {
  initialData: TreeNode[];
}

export function CategoryTreeClient({ initialData }: CategoryTreeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<TreeNode[]>(initialData);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false); // 跟踪拖拽操作状态
  const [progress, setProgress] = useState(0); // 进度百分比
  
  // 當 initialData 更新時（例如 router.refresh() 後），同步更新本地 state
  useEffect(() => {
    setData(initialData);
  }, [initialData]);
  
  // 模擬進度條動畫
  useEffect(() => {
    if (!isMoving) {
      setProgress(0);
      return;
    }
    
    // 開始時設置為 10%
    setProgress(10);
    
    // 模擬進度增加
    const interval = setInterval(() => {
      setProgress((prev) => {
        // 逐漸增加，但不要超過 90%（留給完成時）
        if (prev >= 90) {
          return 90;
        }
        // 每次增加 5-10%，速度逐漸減慢
        const increment = prev < 50 ? 10 : prev < 80 ? 5 : 2;
        return Math.min(prev + increment, 90);
      });
    }, 200); // 每 200ms 更新一次
    
    return () => {
      clearInterval(interval);
    };
  }, [isMoving]);
  
  // 重新獲取數據並更新本地 state
  const refreshData = async () => {
    try {
      const newData = await getCategories();
      setData(newData);
    } catch (error) {
      console.error('Failed to refresh categories:', error);
    }
  };
  
  const handleNodeMove = async (
    activeId: string,
    overId: string | null,
    position: 'before' | 'after' | 'inside'
  ) => {
    // 如果正在移動，禁止新的拖拽操作
    if (isMoving) {
      return;
    }
    
    setMoveError(null);
    setIsMoving(true); // 開始移動
    
    startTransition(async () => {
      try {
        await updateCategoryOrder(activeId, overId, position);
        // 重新獲取數據以確保同步
        await refreshData();
        router.refresh(); // 刷新 Server Component
      } catch (error) {
        console.error('Failed to move node:', error);
        const errorMessage = error instanceof Error ? error.message : '移動分類時發生錯誤';
        setMoveError(errorMessage);
        // 如果失敗，恢復數據
        await refreshData();
        // 3 秒後清除錯誤訊息
        setTimeout(() => setMoveError(null), 3000);
      } finally {
        // 完成時設置為 100%
        setProgress(100);
        // 短暫延遲後重置移動狀態和進度
        setTimeout(() => {
          setIsMoving(false);
          setProgress(0);
        }, 300);
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
    
    // Optimistic update: 立即從本地 state 中移除
    const removeNodeRecursive = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .filter(node => node.id !== id)
        .map(node => ({
          ...node,
          children: node.children ? removeNodeRecursive(node.children) : [],
        }));
    };
    
    setData(prevData => removeNodeRecursive(prevData));
    
    startTransition(async () => {
      try {
        await deleteCategory(id);
        // 重新獲取數據以確保同步
        await refreshData();
        router.refresh(); // 刷新 Server Component
      } catch (error) {
        console.error('Failed to delete node:', error);
        // 如果失敗，恢復數據
        await refreshData();
        if (error instanceof Error) {
          alert(error.message);
        }
      }
    });
  };
  
  const handleAddCategory = () => {
    setAddDialogOpen(true);
  };
  
  const handleAddDialogClose = (open: boolean) => {
    setAddDialogOpen(open);
    // 如果对话框关闭且操作成功，刷新数据
    if (!open) {
      refreshData();
      router.refresh();
    }
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
        <div className="border rounded-lg p-4 bg-card relative">
          <SortableTree
            data={data}
            onNodeMove={handleNodeMove}
            onNodeEdit={handleNodeEdit}
            onNodeDelete={handleNodeDelete}
            disabled={isMoving}
          />
          {isMoving && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
              <div className="flex flex-col items-center gap-4 w-full max-w-xs px-6">
                {/* 圓形進度條 */}
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    {/* 背景圓 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-muted/20"
                    />
                    {/* 進度圓 */}
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      className="text-primary transition-all duration-200"
                    />
                  </svg>
                  {/* 中心百分比文字 */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
                {/* 文字提示 */}
                <div className="flex flex-col items-center gap-1">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">
                    更新中...
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {moveError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <h4 className="font-semibold text-destructive mb-1">移動失敗</h4>
              <p className="text-sm text-destructive/80">
                {moveError}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 新增分類對話框 */}
      <EditCategoryDialog
        open={addDialogOpen}
        onOpenChange={handleAddDialogClose}
        categoryId={null}
        parentId={null}
        initialName=""
        initialDescription={null}
      />
    </div>
  );
}
