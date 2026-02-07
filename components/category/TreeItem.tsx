/**
 * TreeItem - 遞迴樹節點組件
 * 
 * 關鍵特性：
 * - 遞迴渲染子節點
 * - 支持拖拽（使用 @dnd-kit）
 * - Shadcn/UI 風格
 * - 展開/收合功能
 * - 整合操作選單（編輯/新增子分類/刪除）
 */

'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronRight, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { TreeNode } from '@/lib/types/category';
import { useCategoryStore } from '@/store/useCategoryStore';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { CategoryActionMenu } from './CategoryActionMenu';
import { EditCategoryDialog } from './EditCategoryDialog';
import { DeleteAlert } from './DeleteAlert';

interface TreeItemProps {
  node: TreeNode;
  level?: number;
  isOver?: boolean;
  dropPosition?: 'before' | 'after' | 'inside' | null;
}

export function TreeItem({ node, level = 0, isOver = false, dropPosition = null }: TreeItemProps) {
  const { expandedIds, activeId, selectedId, toggleExpand, setSelectedId } = useCategoryStore();
  const isExpanded = expandedIds.has(node.id);
  const isActive = activeId === node.id;
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  
  // 對話框狀態
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addSubDialogOpen, setAddSubDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled: false,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  const handleToggle = () => {
    if (hasChildren) {
      toggleExpand(node.id);
    }
  };
  
  const handleClick = () => {
    setSelectedId(node.id);
  };
  
  const handleEdit = () => {
    setEditDialogOpen(true);
  };
  
  const handleAddSubCategory = () => {
    setAddSubDialogOpen(true);
  };
  
  const handleDelete = () => {
    setDeleteAlertOpen(true);
  };
  
  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group relative',
          isDragging && 'z-50'
        )}
      >
        {/* 拖拽位置指示器 - Before */}
        {isOver && dropPosition === 'before' && (
          <div className="h-0.5 bg-primary rounded-full mb-1 mx-2" />
        )}
        
        <Card
          className={cn(
            'mb-1 transition-all duration-200',
            isSelected && 'ring-2 ring-primary',
            isActive && 'bg-muted/50',
            isDragging && 'shadow-lg',
            isOver && dropPosition === 'inside' && 'ring-2 ring-primary ring-dashed bg-primary/5',
            isOver && dropPosition === 'after' && 'ring-2 ring-primary'
          )}
          onClick={handleClick}
        >
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              {/* 拖拽手柄 */}
              <button
                {...attributes}
                {...listeners}
                className={cn(
                  'cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted transition-colors',
                  'text-muted-foreground hover:text-foreground'
                )}
                aria-label="拖拽"
              >
                <GripVertical className="w-4 h-4" />
              </button>
              
              {/* 展開/收合按鈕 */}
              {hasChildren ? (
                <button
                  onClick={handleToggle}
                  className={cn(
                    'p-1 rounded hover:bg-muted transition-all',
                    'text-muted-foreground hover:text-foreground'
                  )}
                  aria-label={isExpanded ? '收合' : '展開'}
                >
                  <ChevronRight
                    className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </button>
              ) : (
                <div className="w-6" /> // 佔位符，保持對齊
              )}
              
              {/* 節點內容 */}
              <div
                className="flex-1 min-w-0"
                style={{ paddingLeft: `${level * 1.5}rem` }}
              >
                <div className="font-medium text-sm">{node.name}</div>
                {node.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {node.description}
                  </div>
                )}
              </div>
              
              {/* 操作選單 */}
              {/* 移動端：永遠顯示 | 桌面端：hover 顯示 */}
              <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                <CategoryActionMenu
                  onEdit={handleEdit}
                  onAddSubCategory={handleAddSubCategory}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* 拖拽位置指示器 - After */}
        {isOver && dropPosition === 'after' && (
          <div className="h-0.5 bg-primary rounded-full mt-1 mx-2" />
        )}
        
        {/* 遞迴渲染子節點 */}
        {hasChildren && isExpanded && (
          <div className="ml-4 mt-1">
            {node.children!.map((child) => (
              <TreeItem
                key={child.id}
                node={child}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* 編輯對話框 */}
      <EditCategoryDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        categoryId={node.id}
        parentId={node.parent_id}
        initialName={node.name}
        initialDescription={node.description}
      />
      
      {/* 新增子分類對話框 */}
      <EditCategoryDialog
        open={addSubDialogOpen}
        onOpenChange={setAddSubDialogOpen}
        categoryId={null}
        parentId={node.id}
        initialName=""
        initialDescription={null}
      />
      
      {/* 刪除確認對話框 */}
      <DeleteAlert
        open={deleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        category={node}
      />
    </>
  );
}
