/**
 * Category 類型定義
 * 對應 Supabase categories 表的結構
 */

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  
  // 前端使用的擴展字段
  children?: Category[];
}

/**
 * 扁平化的 Category 數據（用於 Zustand Store）
 */
export interface FlatCategory extends Omit<Category, 'children'> {
  children?: string[]; // 子節點的 ID 數組
}

/**
 * 樹狀結構的 Category（用於渲染）
 */
export interface TreeNode extends Category {
  children?: TreeNode[];
}
