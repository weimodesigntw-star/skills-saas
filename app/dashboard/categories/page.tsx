/**
 * Categories Page
 * 
 * 分類管理頁面
 * - Server Component 獲取初始數據
 * - Client Component 處理拖拽交互
 */

import { getCategories } from '@/app/actions/categories';
import { CategoryTreeClient } from './CategoryTreeClient';
import { TreeNode } from '@/lib/types/category';
import { AiCategoryGenerator } from '@/components/ai-category-generator';
import { PaymentStatusWrapper } from './PaymentStatusWrapper';
import { UpgradeButton } from '@/components/stripe/UpgradeButton';
import { createServerClient } from '@/lib/supabase/server';

// 此页面需要动态渲染，因为使用了 cookies 来获取用户认证状态
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  // Server Component：獲取初始數據
  let categories: TreeNode[] = [];
  let isPro = false;
  
  try {
    categories = await getCategories();
    
    // 獲取用戶的 tier 狀態
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .maybeSingle();
      
      isPro = profile?.tier === 'pro';
    }
  } catch (error) {
    console.error('Failed to load categories:', error);
    // 如果未登入或數據為空，顯示空狀態
  }
  
  return (
    <>
      {/* 支付狀態提示 */}
      <PaymentStatusWrapper />

      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-3xl font-bold">分類管理</h1>
            <UpgradeButton isPro={isPro} />
          </div>
          <p className="text-muted-foreground mt-2">
            拖拽節點可以重新排序，支持無限層級嵌套
          </p>
        </div>

        {/* AI 分類生成器 */}
        <AiCategoryGenerator />

        {/* Client Component：處理拖拽和交互 */}
        <CategoryTreeClient initialData={categories} />
      </div>
    </>
  );
}
