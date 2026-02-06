/**
 * Supabase Client
 * 用於 Client Components
 * 
 * 使用 @supabase/ssr 的 createBrowserClient
 * 它會自動處理 cookies（使用瀏覽器的 document.cookie）
 */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
