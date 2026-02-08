/**
 * Supabase Server Client
 * 用於 Server Components 和 Server Actions
 * 
 * 使用 @supabase/ssr 以正確處理 cookies
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export function createServerClient() {
  const cookieStore = cookies();
  
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // 在 Server Actions 中設置 cookies 可能會失敗
            // 這是正常的，因為 Server Actions 在請求處理後執行
          }
        },
      },
    }
  );
}

/**
 * Supabase Admin Client
 * 
 * 使用 Service Role Key 繞過 RLS (Row Level Security)
 * 僅用於需要管理員權限的操作（如 Webhook 更新用戶訂閱狀態）
 * 
 * ⚠️ 警告：此客戶端具有完整資料庫訪問權限，請謹慎使用
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set in environment variables');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
