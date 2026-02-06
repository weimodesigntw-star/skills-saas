/**
 * Supabase Server Client
 * 用於 Server Components 和 Server Actions
 * 
 * 使用 @supabase/ssr 以正確處理 cookies
 */

import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
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
