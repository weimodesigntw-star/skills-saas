/**
 * Category Tree Store
 * 
 * 使用 Zustand 管理分類樹的狀態：
 * - 展開/收合狀態
 * - 拖曳中的節點
 * - 選中的節點
 * - 扁平化的數據結構（方便 @dnd-kit 操作）
 */

import { create } from 'zustand';
import { Category, FlatCategory, TreeNode } from '@/lib/types/category';

interface CategoryStore {
  // ============================================
  // State
  // ============================================
  
  /**
   * 扁平化的分類數據
   * key: category.id
   * value: Category (包含 children 為 ID 數組)
   */
  items: Map<string, FlatCategory>;
  
  /**
   * 展開的節點 ID 集合
   */
  expandedIds: Set<string>;
  
  /**
   * 當前拖曳中的節點 ID
   */
  activeId: string | null;
  
  /**
   * 當前選中的節點 ID
   */
  selectedId: string | null;
  
  // ============================================
  // Actions
  // ============================================
  
  /**
   * 設置分類數據（從 API 獲取後調用）
   * 會自動將樹狀結構轉換為扁平結構
   */
  setItems: (tree: TreeNode[]) => void;
  
  /**
   * 切換節點的展開/收合狀態
   */
  toggleExpand: (id: string) => void;
  
  /**
   * 展開所有節點
   */
  expandAll: () => void;
  
  /**
   * 收合所有節點
   */
  collapseAll: () => void;
  
  /**
   * 設置當前拖曳中的節點
   */
  setActiveId: (id: string | null) => void;
  
  /**
   * 設置當前選中的節點
   */
  setSelectedId: (id: string | null) => void;
  
  /**
   * 移動節點（拖曳結束後調用）
   * @param activeId - 被拖曳的節點 ID
   * @param overId - 目標節點 ID（null 表示移動到根層級）
   * @param position - 位置：'before' | 'after' | 'inside'
   */
  moveNode: (activeId: string, overId: string | null, position: 'before' | 'after' | 'inside') => void;
  
  /**
   * 獲取樹狀結構（用於渲染）
   */
  getTree: () => TreeNode[];
  
  /**
   * 獲取節點的所有子節點 ID（遞迴）
   */
  getDescendantIds: (id: string) => string[];
  
  /**
   * 重置 Store
   */
  reset: () => void;
}

const initialState = {
  items: new Map<string, FlatCategory>(),
  expandedIds: new Set<string>(),
  activeId: null as string | null,
  selectedId: null as string | null,
};

/**
 * 將樹狀結構轉換為扁平結構
 */
function flattenTree(nodes: TreeNode[], parentId: string | null = null): Map<string, FlatCategory> {
  const flatMap = new Map<string, FlatCategory>();
  
  nodes.forEach((node, index) => {
    const flatNode: FlatCategory = {
      ...node,
      parent_id: parentId,
      sort_order: index,
      children: node.children?.map(child => child.id) || [],
    };
    
    flatMap.set(node.id, flatNode);
    
    // 遞迴處理子節點
    if (node.children && node.children.length > 0) {
      const childMap = flattenTree(node.children, node.id);
      childMap.forEach((child, id) => flatMap.set(id, child));
    }
  });
  
  return flatMap;
}

/**
 * 將扁平結構轉換為樹狀結構
 */
function buildTree(flatMap: Map<string, FlatCategory>): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];
  
  // 第一遍：創建所有節點
  flatMap.forEach((flat, id) => {
    const node: TreeNode = {
      ...flat,
      children: [],
    };
    nodeMap.set(id, node);
  });
  
  // 第二遍：建立父子關係
  flatMap.forEach((flat, id) => {
    const node = nodeMap.get(id)!;
    
    if (flat.parent_id === null) {
      rootNodes.push(node);
    } else {
      const parent = nodeMap.get(flat.parent_id);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(node);
      }
    }
  });
  
  // 排序
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const aFlat = flatMap.get(a.id);
      const bFlat = flatMap.get(b.id);
      return (aFlat?.sort_order || 0) - (bFlat?.sort_order || 0);
    });
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  
  sortNodes(rootNodes);
  return rootNodes;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  ...initialState,
  
  setItems: (tree: TreeNode[]) => {
    const flatMap = flattenTree(tree);
    set({ items: flatMap });
  },
  
  toggleExpand: (id: string) => {
    set((state) => {
      const newExpandedIds = new Set(state.expandedIds);
      if (newExpandedIds.has(id)) {
        newExpandedIds.delete(id);
      } else {
        newExpandedIds.add(id);
      }
      return { expandedIds: newExpandedIds };
    });
  },
  
  expandAll: () => {
    set((state) => {
      const allIds = Array.from(state.items.keys());
      return { expandedIds: new Set(allIds) };
    });
  },
  
  collapseAll: () => {
    set({ expandedIds: new Set() });
  },
  
  setActiveId: (id: string | null) => {
    set({ activeId: id });
  },
  
  setSelectedId: (id: string | null) => {
    set({ selectedId: id });
  },
  
  moveNode: (activeId: string, overId: string | null, position: 'before' | 'after' | 'inside') => {
    set((state) => {
      const newItems = new Map(state.items);
      const activeNode = newItems.get(activeId);
      
      if (!activeNode) return state;
      
      // 獲取當前父節點的所有兄弟節點
      const currentParent = activeNode.parent_id;
      const siblings = Array.from(newItems.values()).filter(
        item => item.parent_id === currentParent && item.id !== activeId
      );
      
      let newParentId: string | null = null;
      let newSortOrder = 0;
      
      if (position === 'inside' && overId) {
        // 移動到目標節點內部
        newParentId = overId;
        const targetChildren = Array.from(newItems.values()).filter(
          item => item.parent_id === overId
        );
        newSortOrder = targetChildren.length;
      } else if (overId) {
        // 移動到目標節點之前或之後
        const overNode = newItems.get(overId);
        if (!overNode) return state;
        
        newParentId = overNode.parent_id;
        const targetSiblings = Array.from(newItems.values()).filter(
          item => item.parent_id === newParentId && item.id !== activeId
        );
        
        const overIndex = targetSiblings.findIndex(item => item.id === overId);
        if (position === 'before') {
          newSortOrder = overIndex;
        } else {
          newSortOrder = overIndex + 1;
        }
      } else {
        // 移動到根層級
        newParentId = null;
        const rootNodes = Array.from(newItems.values()).filter(
          item => item.parent_id === null && item.id !== activeId
        );
        newSortOrder = rootNodes.length;
      }
      
      // 更新 activeNode
      const updatedActiveNode: FlatCategory = {
        ...activeNode,
        parent_id: newParentId,
        sort_order: newSortOrder,
      };
      newItems.set(activeId, updatedActiveNode);
      
      // 重新排序受影響的節點
      const affectedSiblings = Array.from(newItems.values()).filter(
        item => item.parent_id === newParentId && item.id !== activeId
      );
      affectedSiblings.forEach((sibling, index) => {
        if (sibling.id !== activeId) {
          const newOrder = index >= newSortOrder ? index + 1 : index;
          newItems.set(sibling.id, { ...sibling, sort_order: newOrder });
        }
      });
      
      return { items: newItems };
    });
  },
  
  getTree: () => {
    const { items } = get();
    return buildTree(items);
  },
  
  getDescendantIds: (id: string) => {
    const { items } = get();
    const descendants: string[] = [];
    
    const collectDescendants = (parentId: string) => {
      const children = Array.from(items.values()).filter(
        item => item.parent_id === parentId
      );
      children.forEach(child => {
        descendants.push(child.id);
        collectDescendants(child.id);
      });
    };
    
    collectDescendants(id);
    return descendants;
  },
  
  reset: () => {
    set(initialState);
  },
}));
