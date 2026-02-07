/**
 * Categories Server Actions
 * 
 * 處理分類樹的 CRUD 操作和拖拽排序
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase/server';
import { Category, TreeNode } from '@/lib/types/category';

/**
 * 獲取用戶分類（樹狀結構）
 */
export async function getUserCategories(): Promise<TreeNode[]> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    // 未登入用戶沒有自己的分類
    return [];
  }
  
  // 查詢該用戶的分類
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch user categories: ${error.message}`);
  }
  
  // 轉換為樹狀結構
  return buildTree(data || []);
}

/**
 * 獲取公共分類（樹狀結構）
 */
export async function getPublicCategories(): Promise<TreeNode[]> {
  const supabase = createServerClient();
  
  // 查詢公共分類（user_id 為 null）
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('user_id', null)
    .order('sort_order', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch public categories: ${error.message}`);
  }
  
  // 轉換為樹狀結構
  return buildTree(data || []);
}

/**
 * 獲取所有分類（樹狀結構）
 * 
 * 邏輯：
 * - 分別獲取用戶分類和公共分類
 * - 返回合併後的數組（保持向後兼容）
 * 
 * @deprecated 建議使用 getUserCategories() 和 getPublicCategories() 分別獲取
 */
export async function getCategories(): Promise<TreeNode[]> {
  const [userCategories, publicCategories] = await Promise.all([
    getUserCategories(),
    getPublicCategories(),
  ]);
  
  // 合併兩個數組
  return [...userCategories, ...publicCategories];
}

/**
 * 更新分類順序（拖拽後調用）
 * 
 * 採用業界標準的 **Fractional Indexing (分數索引/浮點數索引)**
 * 
 * 📚 參考文獻：
 * - Figma 前 CTO 的文章：https://madebyevan.com/algos/crdt-fractional-indexing/
 * - rocicorp/fractional-indexing：https://github.com/rocicorp/fractional-indexing
 * - vlcn.io 概念解釋：https://vlcn.io/blog/fractional-indexing
 * 
 * 🎯 核心優勢：
 * - 解決「公共分類權限」問題：只需更新自己的分類，無需修改公共分類
 * - 解決「排序衝突」問題：使用中間值算法，避免重排整個列表
 * - 原子操作：只更新一個欄位，性能極佳
 * 
 * 🔢 核心邏輯：Midpoint Algorithm
 * - 公式：NewRank = (PrevRank + NextRank) / 2
 * - 邊界優化：開頭使用整數減量 (-10000)，結尾使用整數增量 (+10000)
 * - 精度保護：檢查相鄰節點差值，避免浮點數精度耗盡
 * 
 * ⚠️ 前置假設：資料庫的 sort_order 已經改為 double precision (浮點數)
 * 
 * SQL: ALTER TABLE categories ALTER COLUMN sort_order TYPE double precision;
 */
export async function updateCategoryOrder(
  activeId: string,
  overId: string | null,
  position: 'before' | 'after' | 'inside'
): Promise<void> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  console.log('[Update Category Order]', { activeId, overId, position, userId: user.id });
  
  // ============================================
  // 1. 權限檢查：獲取被移動的節點 (Active)
  // ============================================
  const { data: activeItem, error: activeError } = await supabase
    .from('categories')
    .select('*')
    .eq('id', activeId)
    .maybeSingle();
  
  if (activeError) {
    console.error('[Update Category Order] Active category error:', activeError);
    throw new Error(`Failed to fetch category: ${activeError.message}`);
  }
  
  if (!activeItem) {
    throw new Error('Category not found');
  }
  
  // 如果 activeId 是公共分類 (user_id is null)，直接拋出錯誤
  if (activeItem.user_id === null) {
    throw new Error('Unauthorized: Cannot move public categories');
  }
  
  // 確保 activeId 屬於當前用戶
  if (activeItem.user_id !== user.id) {
    throw new Error('Unauthorized: You can only move your own categories');
  }
  
  // ============================================
  // 2. 確定目標父節點 (Target Parent)
  // ============================================
  let targetParentId: string | null = null;
  
  if (position === 'inside' && overId) {
    // 移動到目標節點內部：parent_id = overId
    targetParentId = overId;
  } else if (overId) {
    // 移動到目標節點之前或之後：parent_id = overItem.parent_id
    const { data: overItem, error: overError } = await supabase
      .from('categories')
      .select('parent_id')
      .eq('id', overId)
      .maybeSingle();
    
    if (overError) {
      console.error('[Update Category Order] Over category error:', overError);
      throw new Error(`Failed to fetch target category: ${overError.message}`);
    }
    
    if (!overItem) {
      throw new Error('Target category not found');
    }
    
    targetParentId = overItem.parent_id;
  } else {
    // 移動到根層級
    targetParentId = null;
  }
  
  // ============================================
  // 3. 獲取上下文：查詢所有兄弟節點
  // 必須包含 user_id = null 的公共分類和 user_id = current_user 的私人分類
  // ============================================
  let siblingsQuery = supabase
    .from('categories')
    .select('id, sort_order, user_id, name')
    .or(`user_id.eq.${user.id},user_id.is.null`) // 查自己 + 公共
    .neq('id', activeId); // 排除自己，避免計算干擾
  
  // 根據 parent_id 是否為 null 使用不同的查詢方式
  if (targetParentId === null) {
    siblingsQuery = siblingsQuery.is('parent_id', null);
  } else {
    siblingsQuery = siblingsQuery.eq('parent_id', targetParentId);
  }
  
  const { data: siblings, error: siblingsError } = await siblingsQuery
    .order('sort_order', { ascending: true });
  
  if (siblingsError) {
    console.error('[Update Category Order] Siblings query error:', siblingsError);
    throw new Error(`Failed to fetch siblings: ${siblingsError.message}`);
  }
  
  const siblingsArray = siblings || [];
  
  console.log('[Update Category Order] Siblings context:', {
    count: siblingsArray.length,
    siblings: siblingsArray.map(s => ({
      id: s.id.substring(0, 8),
      name: s.name,
      sort_order: s.sort_order,
      type: s.user_id === null ? 'public' : 'user',
    })),
  });
  
  // ============================================
  // 4. 計算插入點 (Position Calculation)
  // 根據 position 找出 activeItem 在兄弟陣列中的插入索引
  // ============================================
  let insertIndex = 0;
  let prevRank: number | null = null;
  let nextRank: number | null = null;
  
  if (position === 'inside') {
    // 移動到目標節點內部：插在該節點的所有子節點最後
    insertIndex = siblingsArray.length;
  } else if (position === 'before' && overId) {
    // 插入到目標節點之前
    const overIndex = siblingsArray.findIndex(s => s.id === overId);
    if (overIndex === -1) {
      throw new Error('Target category not found in siblings');
    }
    insertIndex = overIndex;
  } else if (position === 'after' && overId) {
    // 插入到目標節點之後
    const overIndex = siblingsArray.findIndex(s => s.id === overId);
    if (overIndex === -1) {
      throw new Error('Target category not found in siblings');
    }
    insertIndex = overIndex + 1;
  } else {
    // 移動到根層級（overId 為 null）：插在最後
    insertIndex = siblingsArray.length;
  }
  
  // ============================================
  // 5. 計算新的 sort_order（Fractional Indexing）
  // 
  // 根據文獻，我們採用以下策略：
  // - Case A/B: 使用整數增量/減量（避免精度問題，參考 rocicorp 優化）
  // - Case C: 使用中間值算法 (PrevRank + NextRank) / 2
  // - 精度保護：檢查相鄰節點差值，如果太小則重新分配空間
  // ============================================
  let newSortOrder = 0;
  const MIN_SPACING = 1e-10; // 最小間距，避免浮點數精度耗盡
  const BOUNDARY_SPACING = 10000; // 邊界間距（整數增量/減量）
  
  if (insertIndex <= 0) {
    // Case A: 插在最前面 (First)
    // 優化：使用整數減量，而不是分數（參考 rocicorp/fractional-indexing）
    const firstSibling = siblingsArray[0];
    if (firstSibling) {
      newSortOrder = firstSibling.sort_order - BOUNDARY_SPACING;
      prevRank = null;
      nextRank = firstSibling.sort_order;
    } else {
      // 空列表：使用初始值
      newSortOrder = BOUNDARY_SPACING;
      prevRank = null;
      nextRank = null;
    }
  } else if (insertIndex >= siblingsArray.length) {
    // Case B: 插在最後面 (Last)
    // 優化：使用整數增量，而不是分數（參考 rocicorp/fractional-indexing）
    const lastSibling = siblingsArray[siblingsArray.length - 1];
    if (lastSibling) {
      newSortOrder = lastSibling.sort_order + BOUNDARY_SPACING;
      prevRank = lastSibling.sort_order;
      nextRank = null;
    } else {
      // 空列表：使用初始值
      newSortOrder = BOUNDARY_SPACING;
      prevRank = null;
      nextRank = null;
    }
  } else {
    // Case C: 插在中間 (Between)
    // 核心算法：Midpoint Algorithm (參考 Figma 前 CTO 的文章)
    const prevSibling = siblingsArray[insertIndex - 1];
    const nextSibling = siblingsArray[insertIndex];
    const prevSortOrder = prevSibling.sort_order;
    const nextSortOrder = nextSibling.sort_order;
    
    // 精度保護：如果兩個相鄰節點的差值太小，需要重新分配空間
    const spacing = nextSortOrder - prevSortOrder;
    if (spacing < MIN_SPACING) {
      // 這種情況極少發生，但如果發生，我們需要重新分配空間
      // 策略：在 prevSortOrder 和 nextSortOrder 之間插入一個較大的間距
      console.warn('[Update Category Order] Precision warning: spacing too small, reallocating space', {
        prevSortOrder,
        nextSortOrder,
        spacing,
      });
      // 使用更大的間距來重新分配
      newSortOrder = prevSortOrder + (spacing * 0.5) + BOUNDARY_SPACING * 0.01;
    } else {
      // 正常情況：使用中間值算法
      newSortOrder = (prevSortOrder + nextSortOrder) / 2;
    }
    
    prevRank = prevSortOrder;
    nextRank = nextSortOrder;
  }
  
  // 構建公式字符串（用於日誌）
  let formulaStr = '';
  if (prevRank !== null && nextRank !== null) {
    formulaStr = `(${prevRank} + ${nextRank}) / 2 = ${newSortOrder}`;
  } else if (prevRank !== null) {
    formulaStr = `${prevRank} + ${BOUNDARY_SPACING} = ${newSortOrder}`;
  } else if (nextRank !== null) {
    formulaStr = `${nextRank} - ${BOUNDARY_SPACING} = ${newSortOrder}`;
  } else {
    formulaStr = `${BOUNDARY_SPACING} (empty list)`;
  }
  
  console.log('[Update Category Order] Fractional Indexing calculation:', {
    activeItem: activeItem.name,
    position,
    insertIndex,
    prevRank,
    nextRank,
    newSortOrder,
    formula: formulaStr,
    algorithm: 'Midpoint Algorithm (Figma/rocicorp standard)',
  });
  
  // ============================================
  // 6. 執行更新 (Atomic Update)
  // 只執行一個 UPDATE 語句，只更新 activeId 這一筆資料
  // ============================================
  const { error: updateError } = await supabase
    .from('categories')
    .update({
      sort_order: newSortOrder,
      parent_id: targetParentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeId)
    .eq('user_id', user.id); // 權限檢查：再次確認 activeId 屬於當前用戶
  
  if (updateError) {
    console.error('[Update Category Order] Update error:', updateError);
    throw new Error(`Failed to update category order: ${updateError.message}`);
  }
  
  // ============================================
  // 7. 更新 path（可選，用於快速查詢）
  // ============================================
  try {
    await updateCategoryPath(activeId, targetParentId, supabase, user.id);
  } catch (pathError) {
    console.error('[Update Category Order] Path update error:', pathError);
    // Path 更新失敗不應該阻止整個操作
  }
  
  console.log('[Update Category Order] Success - Updated only activeItem:', {
    id: activeId,
    name: activeItem.name,
    newSortOrder,
    newParentId: targetParentId,
  });
  
  revalidatePath('/dashboard/categories');
}

/**
 * 更新分類路徑（遞迴更新所有子節點）
 */
async function updateCategoryPath(
  categoryId: string,
  parentId: string | null,
  supabase: any,
  userId: string
): Promise<void> {
  // 構建新路徑
  let newPath = '';
  if (parentId) {
    const { data: parent } = await supabase
      .from('categories')
      .select('path, name')
      .eq('id', parentId)
      .single();
    
    if (parent) {
      newPath = parent.path ? `${parent.path}/${parent.name}` : parent.name;
    }
  }
  
  // 更新當前節點
  const { data: current } = await supabase
    .from('categories')
    .select('name')
    .eq('id', categoryId)
    .single();
  
  if (current) {
    const fullPath = newPath ? `${newPath}/${current.name}` : current.name;
    await supabase
      .from('categories')
      .update({ path: fullPath })
      .eq('id', categoryId);
  }
  
  // 遞迴更新所有子節點
  const { data: children } = await supabase
    .from('categories')
    .select('id')
    .eq('parent_id', categoryId)
    .eq('user_id', userId);
  
  if (children) {
    for (const child of children) {
      await updateCategoryPath(child.id, categoryId, supabase, userId);
    }
  }
}

/**
 * 將扁平結構轉換為樹狀結構
 */
function buildTree(categories: Category[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  const rootNodes: TreeNode[] = [];
  
  // 第一遍：創建所有節點
  categories.forEach(cat => {
    const node: TreeNode = {
      ...cat,
      children: [],
    };
    nodeMap.set(cat.id, node);
  });
  
  // 第二遍：建立父子關係
  categories.forEach(cat => {
    const node = nodeMap.get(cat.id)!;
    
    if (cat.parent_id === null) {
      rootNodes.push(node);
    } else {
      const parent = nodeMap.get(cat.parent_id);
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
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  
  sortNodes(rootNodes);
  return rootNodes;
}

/**
 * 創建分類
 */
export async function createCategory(
  name: string,
  description: string | null,
  parentId: string | null
): Promise<Category> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  // 獲取同一層級的最大 sort_order
  const { data: siblings } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('parent_id', parentId)
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  
  const sortOrder = siblings && siblings.length > 0 ? siblings[0].sort_order + 1 : 0;
  
  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id: user.id,
      name,
      description,
      parent_id: parentId,
      sort_order: sortOrder,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create category: ${error.message}`);
  }
  
  revalidatePath('/dashboard/categories');
  return data;
}

/**
 * 更新分類
 */
export async function updateCategory(
  id: string,
  name: string,
  description: string | null
): Promise<void> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  const { error } = await supabase
    .from('categories')
    .update({
      name,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);
  
  if (error) {
    throw new Error(`Failed to update category: ${error.message}`);
  }
  
  revalidatePath('/dashboard/categories');
}

/**
 * 刪除分類（級聯刪除所有子節點）
 * 
 * 使用 PostgreSQL RPC 函數確保事務原子性：
 * - 所有操作在單一數據庫事務中執行
 * - 如果任何步驟失敗，整個操作回滾
 * - 避免出現孤兒節點
 */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  // 使用 RPC 函數進行級聯刪除（事務安全）
  const { error } = await supabase.rpc('delete_category_cascade', {
    category_id: id,
    user_id_param: user.id,
  });
  
  if (error) {
    throw new Error(`Failed to delete category: ${error.message}`);
  }
  
  revalidatePath('/dashboard/categories');
}
