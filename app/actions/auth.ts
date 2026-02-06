/**
 * Authentication Server Actions
 * 
 * 處理登入、登出等認證操作
 */

'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';

/**
 * 登入
 */
export async function signIn(email: string, password: string) {
  const supabase = createServerClient();
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // 確保 session 已設置
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    return { error: '登入失敗，無法建立會話' };
  }

  revalidatePath('/', 'layout');
  return { success: true, user: data.user };
}

/**
 * 登出
 */
export async function signOut() {
  const supabase = createServerClient();
  
  await supabase.auth.signOut();
  
  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * 獲取當前用戶
 */
export async function getCurrentUser() {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  return user;
}
