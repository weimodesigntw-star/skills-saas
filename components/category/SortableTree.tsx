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
  disabled?: boolean; // 禁用拖拽功能
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
  items: TreeNode[],
  delta?: { x: number; y: number } | null
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
  
  // 根據拖拽的垂直位置判斷：
  // - 如果拖到節點的上 1/3 部分，插入到該節點之前
  // - 如果拖到節點的下 1/3 部分，插入到該節點之後
  // - 如果拖到節點中間 1/3 部分，作為子節點（inside）
  if (delta && over.rect) {
    const rect = over.rect;
    // delta 是相對於拖拽開始位置的偏移
    // 我們需要計算鼠標相對於目標節點的位置
    // 使用 rect 的 top 和 height 來判斷相對位置
    
    // 計算鼠標在節點內的相對位置（0-1）
    // 注意：delta.y 是絕對位置，rect.top 也是絕對位置
    // 我們需要計算 delta.y 相對於 rect 的位置
    const relativeY = delta.y - rect.top;
    const topThreshold = rect.height * 0.33; // 上 1/3
    const bottomThreshold = rect.height * 0.67; // 下 1/3
    
    if (relativeY < topThreshold) {
      // 上方 1/3：插入到之前
      return {
        overId: overId,
        position: 'before',
      };
    } else if (relativeY > bottomThreshold) {
      // 下方 1/3：插入到之後
      return {
        overId: overId,
        position: 'after',
      };
    }
    // 中間 1/3：作為子節點
    return {
      overId: overId,
      position: 'inside',
    };
  }
  
  // 如果無法獲取 delta 或 rect，檢查是否有子節點
  // 如果有子節點，默認作為子節點；否則作為 before
  if (overNode && overNode.children && overNode.children.length > 0) {
    return {
      overId: overId,
      position: 'inside',
    };
  }
  
  // 默認：插入到之前
  return {
    overId: overId,
    position: 'before',
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
  disabled = false,
}: SortableTreeProps) {
  const { setItems, setActiveId, moveNode, getTree } = useCategoryStore();
  const [activeNode, setActiveNode] = useState<TreeNode | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);
  
  // 初始化 Store
  useMemo(() => {
    setItems(data);
  }, [data, setItems]);
  
  const tree = getTree();
  const allIds = flattenNodeIds(tree);
  
  // 配置傳感器（支持觸控設備）
  // 如果 disabled 為 true，不啟用傳感器（禁用拖拽）
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 拖動 8px 後才開始拖拽
      },
      disabled: disabled, // 禁用傳感器
    })
  );
  
  const handleDragStart = (event: DragStartEvent) => {
    // 如果禁用，不允許開始拖拽
    if (disabled) {
      return;
    }
    
    const { active } = event;
    const node = findNodeById(tree, active.id as string);
    setActiveNode(node);
    setActiveId(active.id as string);
    setOverId(null);
    setDropPosition(null);
  };
  
  const handleDragOver = (event: DragOverEvent) => {
    // 如果禁用，不處理拖拽事件
    if (disabled) {
      return;
    }
    
    const { over, delta } = event;
    
    if (!over) {
      setOverId(null);
      setDropPosition(null);
      return;
    }
    
    const activeId = event.active.id as string;
    
    // 計算相對位置（使用 delta 來計算位置）
    // delta 是相對於拖拽開始位置的偏移量
    const position = getDropPosition(over, activeId, tree, delta);
    
    if (position) {
      setOverId(position.overId);
      setDropPosition(position.position);
    } else {
      setOverId(null);
      setDropPosition(null);
    }
  };
  
  const handleDragEnd = (event: DragEndEvent) => {
    // 如果禁用，不處理拖拽結束事件
    if (disabled) {
      return;
    }
    
    const { active, over } = event;
    
    setActiveNode(null);
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    
    if (!over) return;
    
    const dropInfo = getDropPosition(over, active.id as string, tree, event.delta);
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
              isOver={overId === node.id}
              dropPosition={overId === node.id ? dropPosition : null}
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
