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
 * 獲取所有分類（樹狀結構）
 * 
 * 邏輯：
 * - 如果用戶已登入，只返回該用戶的分類
 * - 如果用戶未登入，返回公共分類（user_id 為 null）
 *   這允許開發階段測試種子數據，無需先登入
 */
export async function getCategories(): Promise<TreeNode[]> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // 構建查詢：已登入用戶查詢自己的分類 + 公共分類，未登入用戶查詢公共分類
  let query = supabase
    .from('categories')
    .select('*');
  
  if (user) {
    // 已登入：查詢該用戶的分類 + 公共分類（user_id 為 null）
    // 這樣用戶可以看到自己的分類和公共分類
    // 使用 or 查詢：user_id = user.id OR user_id IS NULL
    query = query.or(`user_id.eq.${user.id},user_id.is.null`);
  } else {
    // 未登入：查詢公共分類（user_id 為 null）
    query = query.is('user_id', null);
  }
  
  const { data, error } = await query.order('sort_order', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch categories: ${error.message}`);
  }
  
  // 轉換為樹狀結構
  return buildTree(data || []);
}

/**
 * 更新分類順序（拖拽後調用）
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
  
  // 獲取當前分類
  const { data: activeCategory } = await supabase
    .from('categories')
    .select('*')
    .eq('id', activeId)
    .eq('user_id', user.id)
    .single();
  
  if (!activeCategory) {
    throw new Error('Category not found');
  }
  
  let newParentId: string | null = null;
  let newSortOrder = 0;
  
  if (position === 'inside' && overId) {
    // 移動到目標節點內部
    newParentId = overId;
    
    // 獲取目標節點的所有子節點
    const { data: children } = await supabase
      .from('categories')
      .select('sort_order')
      .eq('parent_id', overId)
      .eq('user_id', user.id)
      .order('sort_order', { ascending: false })
      .limit(1);
    
    newSortOrder = children && children.length > 0 ? children[0].sort_order + 1 : 0;
  } else if (overId) {
    // 移動到目標節點之前或之後
    const { data: overCategory } = await supabase
      .from('categories')
      .select('*')
      .eq('id', overId)
      .eq('user_id', user.id)
      .single();
    
    if (!overCategory) {
      throw new Error('Target category not found');
    }
    
    newParentId = overCategory.parent_id;
    
    // 獲取同一層級的所有節點
    const { data: siblings } = await supabase
      .from('categories')
      .select('id, sort_order')
      .eq('parent_id', newParentId)
      .eq('user_id', user.id)
      .neq('id', activeId)
      .order('sort_order', { ascending: true });
    
    const overIndex = siblings?.findIndex(s => s.id === overId) ?? -1;
    
    if (position === 'before') {
      newSortOrder = overIndex;
      // 更新後續節點的順序
      if (siblings) {
        for (let i = overIndex; i < siblings.length; i++) {
          await supabase
            .from('categories')
            .update({ sort_order: i + 1 })
            .eq('id', siblings[i].id);
        }
      }
    } else {
      newSortOrder = overIndex + 1;
      // 更新後續節點的順序
      if (siblings) {
        for (let i = overIndex + 1; i < siblings.length; i++) {
          await supabase
            .from('categories')
            .update({ sort_order: i + 2 })
            .eq('id', siblings[i].id);
        }
      }
    }
  } else {
    // 移動到根層級
    newParentId = null;
    
    const { data: rootNodes } = await supabase
      .from('categories')
      .select('sort_order')
      .is('parent_id', null)
      .eq('user_id', user.id)
      .neq('id', activeId)
      .order('sort_order', { ascending: false })
      .limit(1);
    
    newSortOrder = rootNodes && rootNodes.length > 0 ? rootNodes[0].sort_order + 1 : 0;
  }
  
  // 更新分類
  const { error } = await supabase
    .from('categories')
    .update({
      parent_id: newParentId,
      sort_order: newSortOrder,
      updated_at: new Date().toISOString(),
    })
    .eq('id', activeId)
    .eq('user_id', user.id);
  
  if (error) {
    throw new Error(`Failed to update category order: ${error.message}`);
  }
  
  // 更新 path（可選，用於快速查詢）
  await updateCategoryPath(activeId, newParentId, supabase, user.id);
  
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
