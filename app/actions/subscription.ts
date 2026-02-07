/**
 * Subscription & Quota Server Actions
 * 
 * 處理用戶配額檢查和 AI 使用次數追蹤
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { FREE_DAILY_LIMIT } from '@/lib/config/subscription';

/**
 * 檢查 AI 使用配額
 * 
 * 邏輯：
 * - Pro 用戶：無限制，直接返回 true
 * - Free 用戶：
 *   - 檢查 last_reset_date 是否為「昨天以前」，如果是則重置計數
 *   - 檢查 ai_usage_count 是否小於 FREE_DAILY_LIMIT
 *   - 返回 true（通過）或 false（達到限制）
 * 
 * @returns {Promise<{ allowed: boolean; remaining?: number; limit?: number; resetDate?: Date }>}
 */
export async function checkAiLimit(): Promise<{
  allowed: boolean;
  remaining?: number;
  limit?: number;
  resetDate?: Date;
  tier?: string;
}> {
  const supabase = createServerClient();
  
  // 1. 獲取當前用戶
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('[Check AI Limit] Auth error:', authError);
    return { allowed: false };
  }
  
  // 2. 獲取用戶的 profile 資料
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count, last_reset_date')
    .eq('id', user.id)
    .maybeSingle();
  
  if (profileError) {
    console.error('[Check AI Limit] Profile fetch error:', profileError);
    return { allowed: false };
  }
  
  // 如果 profile 不存在，創建一個（使用默認值）
  if (!profile) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email || '',
        tier: 'free',
        ai_usage_count: 0,
        last_reset_date: new Date().toISOString(),
      });
    
    if (insertError) {
      console.error('[Check AI Limit] Profile creation error:', insertError);
      return { allowed: false };
    }
    
    // 返回新創建的 profile 的配額信息
    return {
      allowed: true,
      remaining: FREE_DAILY_LIMIT,
      limit: FREE_DAILY_LIMIT,
      resetDate: new Date(),
      tier: 'free',
    };
  }
  
  const tier = profile.tier || 'free';
  
  // 3. Pro 用戶：無限制
  if (tier === 'pro') {
    return {
      allowed: true,
      tier: 'pro',
    };
  }
  
  // 4. Free 用戶：檢查配額
  const now = new Date();
  const lastResetDate = profile.last_reset_date 
    ? new Date(profile.last_reset_date) 
    : new Date();
  
  // 計算是否為「昨天以前」（使用 UTC 日期比較，忽略時間）
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const lastReset = new Date(Date.UTC(
    lastResetDate.getFullYear(), 
    lastResetDate.getMonth(), 
    lastResetDate.getDate()
  ));
  
  const daysDiff = Math.floor((today.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  
  let currentUsage = profile.ai_usage_count || 0;
  let shouldReset = false;
  
  // 如果 last_reset_date 是「昨天以前」，重置計數
  if (daysDiff >= 1) {
    shouldReset = true;
    currentUsage = 0;
    
    // 更新資料庫
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ai_usage_count: 0,
        last_reset_date: now.toISOString(),
      })
      .eq('id', user.id);
    
    if (updateError) {
      console.error('[Check AI Limit] Reset error:', updateError);
      // 即使重置失敗，我們仍然使用記憶體中的值繼續檢查
    } else {
      console.log('[Check AI Limit] Reset usage count for user:', user.id);
    }
  }
  
  // 5. 檢查是否達到限制
  const remaining = Math.max(0, FREE_DAILY_LIMIT - currentUsage);
  const allowed = currentUsage < FREE_DAILY_LIMIT;
  
  // 計算下次重置日期（明天）
  const resetDate = new Date(today);
  resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  
  console.log('[Check AI Limit]', {
    userId: user.id,
    tier,
    currentUsage,
    limit: FREE_DAILY_LIMIT,
    remaining,
    allowed,
    daysDiff,
    shouldReset,
  });
  
  return {
    allowed,
    remaining,
    limit: FREE_DAILY_LIMIT,
    resetDate,
    tier,
  };
}

/**
 * 增加 AI 使用次數
 * 
 * 當 AI 生成成功後呼叫此函數，將 ai_usage_count +1
 * 
 * @returns {Promise<{ success: boolean; error?: string }>}
 */
export async function incrementAiUsage(): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = createServerClient();
  
  // 1. 獲取當前用戶
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.error('[Increment AI Usage] Auth error:', authError);
    return { success: false, error: 'Unauthorized' };
  }
  
  // 2. 獲取當前使用次數
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('ai_usage_count, tier')
    .eq('id', user.id)
    .maybeSingle();
  
  if (profileError) {
    console.error('[Increment AI Usage] Profile fetch error:', profileError);
    return { success: false, error: profileError.message };
  }
  
  // Pro 用戶不需要追蹤使用次數（但我們仍然記錄，用於統計）
  const tier = profile?.tier || 'free';
  
  // 3. 增加使用次數
  const currentCount = profile?.ai_usage_count || 0;
  const newCount = currentCount + 1;
  
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      ai_usage_count: newCount,
    })
    .eq('id', user.id);
  
  if (updateError) {
    console.error('[Increment AI Usage] Update error:', updateError);
    return { success: false, error: updateError.message };
  }
  
  console.log('[Increment AI Usage] Success', {
    userId: user.id,
    tier,
    oldCount: currentCount,
    newCount,
  });
  
  return { success: true };
}

/**
 * 獲取用戶配額信息（用於顯示）
 * 
 * @returns {Promise<{ tier: string; usage: number; limit: number; resetDate: Date } | null>}
 */
export async function getUserQuota(): Promise<{
  tier: string;
  usage: number;
  limit: number;
  resetDate: Date;
} | null> {
  const supabase = createServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return null;
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count, last_reset_date')
    .eq('id', user.id)
    .maybeSingle();
  
  if (!profile) {
    return {
      tier: 'free',
      usage: 0,
      limit: FREE_DAILY_LIMIT,
      resetDate: new Date(),
    };
  }
  
  const tier = profile.tier || 'free';
  
  // 計算重置日期
  const lastResetDate = profile.last_reset_date 
    ? new Date(profile.last_reset_date) 
    : new Date();
  
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const lastReset = new Date(Date.UTC(
    lastResetDate.getFullYear(), 
    lastResetDate.getMonth(), 
    lastResetDate.getDate()
  ));
  
  const daysDiff = Math.floor((today.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  
  // 如果已經過了一天，重置計數
  const usage = daysDiff >= 1 ? 0 : (profile.ai_usage_count || 0);
  
  // 計算下次重置日期
  const resetDate = new Date(today);
  resetDate.setUTCDate(resetDate.getUTCDate() + 1);
  
  return {
    tier,
    usage,
    limit: tier === 'pro' ? Infinity : FREE_DAILY_LIMIT,
    resetDate,
  };
}
