/**
 * SortableTree - 可拖拽的分類樹組件
 * 
 * 核心功能：
 * - 無限層級嵌套
 * - 跨層級拖拽
 * - DragOverlay 視覺反饋
 * - 與 Zustand Store 整合
 */

'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  Over,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useState, useMemo } from 'react';
import { TreeNode } from '@/lib/types/category';
import { useCategoryStore } from '@/store/useCategoryStore';
import { TreeItem } from './TreeItem';
import { Card } from '@/components/ui/card';

interface SortableTreeProps {
  data: TreeNode[];
  onNodeMove?: (activeId: string, overId: string | null, position: 'before' | 'after' | 'inside') => void;
  onNodeEdit?: (id: string) => void;
  onNodeDelete?: (id: string) => void;
}

/**
 * 獲取節點的所有 ID（扁平化）
 */
function flattenNodeIds(nodes: TreeNode[]): string[] {
  const ids: string[] = [];
  nodes.forEach(node => {
    ids.push(node.id);
    if (node.children) {
      ids.push(...flattenNodeIds(node.children));
    }
  });
  return ids;
}

/**
 * 根據拖拽位置判斷放置位置
 */
function getDropPosition(
  over: Over | null,
  activeId: string,
  items: TreeNode[]
): { overId: string | null; position: 'before' | 'after' | 'inside' } | null {
  if (!over) return null;
  
  const overId = over.id as string;
  const activeNode = findNodeById(items, activeId);
  const overNode = findNodeById(items, overId);
  
  if (!activeNode || !overNode) return null;
  
  // 不能將節點拖到自己或自己的子節點
  if (activeId === overId || isDescendant(activeNode, overId, items)) {
    return null;
  }
  
  // 獲取拖拽數據
  const data = over.data.current;
  
  // 如果有明確的位置指示（來自 TreeItem 的數據）
  if (data?.position) {
    return {
      overId: overId,
      position: data.position,
    };
  }
  
  // 默認：如果拖到節點上方，插入到該節點之前
  // 如果拖到節點下方，插入到該節點之後
  // 如果拖到節點內部，作為子節點
  return {
    overId: overId,
    position: 'inside', // 默認作為子節點
  };
}

/**
 * 查找節點
 */
function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 檢查是否為子節點
 */
function isDescendant(node: TreeNode, descendantId: string, allNodes: TreeNode[]): boolean {
  if (!node.children) return false;
  for (const child of node.children) {
    if (child.id === descendantId) return true;
    if (isDescendant(child, descendantId, allNodes)) return true;
  }
  return false;
}

export function SortableTree({
  data,
  onNodeMove,
  onNodeEdit,
  onNodeDelete,
}: SortableTreeProps) {
  const { setItems, setActiveId, moveNode, getTree } = useCategoryStore();
  const [activeNode, setActiveNode] = useState<TreeNode | null>(null);
  
  // 初始化 Store
  useMemo(() => {
    setItems(data);
  }, [data, setItems]);
  
  const tree = getTree();
  const allIds = flattenNodeIds(tree);
  
  // 配置傳感器（支持觸控設備）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖動 8px 後才開始拖拽
      },
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const node = findNodeById(tree, active.id as string);
    setActiveNode(node);
    setActiveId(active.id as string);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    // 這裡可以添加視覺反饋邏輯
    // 例如：高亮目標節點
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveNode(null);
    setActiveId(null);
    
    if (!over) return;
    
    const dropInfo = getDropPosition(over, active.id as string, tree);
    if (!dropInfo) return;
    
    // 更新 Store
    moveNode(active.id as string, dropInfo.overId, dropInfo.position);
    
    // 觸發回調
    if (onNodeMove) {
      onNodeMove(active.id as string, dropInfo.overId, dropInfo.position);
    }
  };
  
  const handleDragCancel = () => {
    setActiveNode(null);
    setActiveId(null);
  };
  
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {tree.map((node) => (
            <TreeItem
              key={node.id}
              node={node}
              onEdit={onNodeEdit}
              onDelete={onNodeDelete}
            />
          ))}
        </div>
      </SortableContext>
      
      {/* DragOverlay - 拖拽時的視覺反饋 */}
      <DragOverlay>
        {activeNode ? (
          <Card className="opacity-90 shadow-lg">
            <div className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4" /> {/* 拖拽手柄佔位 */}
                <div className="font-medium text-sm">{activeNode.name}</div>
              </div>
            </div>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
