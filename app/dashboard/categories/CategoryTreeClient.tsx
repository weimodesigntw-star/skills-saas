/**
 * CategoryTreeClient - 客戶端組件
 * 
 * 處理：
 * - 拖拽交互
 * - 編輯/刪除操作
 * - 與 Server Actions 通信
 */

'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { TreeNode } from '@/lib/types/category';
import { SortableTree } from '@/components/category/SortableTree';
import { EditCategoryDialog } from '@/components/category/EditCategoryDialog';
import { updateCategoryOrder, deleteCategory, getCategories } from '@/app/actions/categories';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, Search, X } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState(''); // 搜索关键词
  
  // 當 initialData 更新時（例如 router.refresh() 後），同步更新本地 state
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // 搜索和过滤逻辑
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }

    const query = searchQuery.toLowerCase().trim();
    
    // 递归搜索函数：检查节点是否匹配，并保留匹配的节点及其父节点
    const searchTree = (nodes: TreeNode[]): TreeNode[] => {
      const result: TreeNode[] = [];
      
      for (const node of nodes) {
        // 检查当前节点是否匹配
        const matchesName = node.name.toLowerCase().includes(query);
        const matchesDescription = node.description?.toLowerCase().includes(query) || false;
        const isMatch = matchesName || matchesDescription;
        
        // 递归搜索子节点
        const filteredChildren = node.children ? searchTree(node.children) : [];
        const hasMatchingChildren = filteredChildren.length > 0;
        
        // 如果当前节点匹配或有匹配的子节点，则保留
        if (isMatch || hasMatchingChildren) {
          result.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
            // 添加搜索匹配标记
            _searchMatch: isMatch,
            _hasMatchingChildren: hasMatchingChildren,
          } as TreeNode);
        }
      }
      
      return result;
    };
    
    return searchTree(data);
  }, [data, searchQuery]);
  
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
      {/* 搜索栏和新增按钮 */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        {/* 搜索输入框 */}
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
          <Input
            type="text"
            placeholder="搜索分類名稱或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground z-10"
              aria-label="清除搜索"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button onClick={handleAddCategory} disabled={isPending} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          新增分類
        </Button>
      </div>
      
      {/* 搜索结果提示 */}
      {searchQuery && (
        <div className="text-sm text-muted-foreground">
          {filteredData.length > 0 ? (
            <>找到 {filteredData.length} 個匹配的分類</>
          ) : (
            <>未找到匹配的分類</>
          )}
        </div>
      )}
      
      {data.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>還沒有分類，點擊「新增分類」開始建立</p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-card relative">
          <SortableTree
            data={filteredData}
            onNodeMove={handleNodeMove}
            onNodeEdit={handleNodeEdit}
            onNodeDelete={handleNodeDelete}
            disabled={isMoving || !!searchQuery}
            searchQuery={searchQuery}
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
