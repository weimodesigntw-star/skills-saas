/**
 * Categories Page
 * 
 * 分類管理頁面
 * - Server Component 獲取初始數據
 * - Client Component 處理拖拽交互
 */

import { getCategories } from '@/app/actions/categories';
import { CategoryTreeClient } from './CategoryTreeClient';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { TreeNode } from '@/lib/types/category';

export default async function CategoriesPage() {
  // Server Component：獲取初始數據
  let categories: TreeNode[] = [];
  
  try {
    categories = await getCategories();
  } catch (error) {
    console.error('Failed to load categories:', error);
    // 如果未登入或數據為空，顯示空狀態
  }
  
  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">分類管理</h1>
          <p className="text-muted-foreground mt-2">
            拖拽節點可以重新排序，支持無限層級嵌套
          </p>
        </div>
        
        {/* Client Component：處理拖拽和交互 */}
        <CategoryTreeClient initialData={categories} />
      </div>
    </DashboardLayout>
  );
}
