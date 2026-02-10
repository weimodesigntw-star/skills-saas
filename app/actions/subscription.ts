/**
 * Subscription & Quota Server Actions
 *
 * 處理用戶配額檢查和 AI 使用次數追蹤
 *
 * 🔒 安全修復：使用資料庫層級的原子操作（RPC）防止競爭條件
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { FREE_DAILY_LIMIT } from '@/lib/config/subscription';

/**
 * 原子化 AI 配額檢查與消耗
 *
 * 使用 Supabase RPC 呼叫資料庫函數 `check_and_increment_ai_usage`，
 * 在單一交易中完成「檢查配額 → 遞增使用量」，
 * 徹底避免競爭條件（Race Condition）。
 *
 * 邏輯：
 * - Pro 用戶：直接允許，不計數
 * - Free 用戶：原子化檢查+遞增，跨日自動重置
 *
 * @returns {Promise<{ allowed: boolean; remaining?: number; limit?: number; tier?: string; error?: string }>}
 */
export async function checkAndConsumeAiQuota(): Promise<{
  allowed: boolean;
  remaining?: number;
  limit?: number;
  tier?: string;
  error?: string;
}> {
  const supabase = createServerClient();

  // 1. 獲取當前用戶
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { allowed: false, error: 'Unauthorized' };
  }

  // 2. 呼叫原子化 RPC 函數
  const { data, error: rpcError } = await supabase.rpc('check_and_increment_ai_usage', {
    p_user_id: user.id,
    p_daily_limit: FREE_DAILY_LIMIT,
  });

  if (rpcError) {
    console.error('[AI Quota] RPC error:', rpcError);
    return { allowed: false, error: rpcError.message };
  }

  if (!data) {
    return { allowed: false, error: 'No response from quota check' };
  }

  return {
    allowed: data.allowed,
    remaining: data.remaining ?? undefined,
    limit: data.limit ?? undefined,
    tier: data.tier ?? undefined,
  };
}

/**
 * 檢查 AI 使用配額（僅查詢，不消耗）
 *
 * 用於前端顯示剩餘配額，不會修改資料庫。
 *
 * @returns {Promise<{ allowed: boolean; remaining?: number; limit?: number; tier?: string }>}
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

  // 如果 profile 不存在，創建一個
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

    return {
      allowed: true,
      remaining: FREE_DAILY_LIMIT,
      limit: FREE_DAILY_LIMIT,
      resetDate: new Date(),
      tier: 'free',
    };
  }

  const tier = profile.tier || 'free';

  // Pro 用戶：無限制
  if (tier === 'pro') {
    return { allowed: true, tier: 'pro' };
  }

  // Free 用戶：檢查配額
  const now = new Date();
  const lastResetDate = profile.last_reset_date
    ? new Date(profile.last_reset_date)
    : new Date();

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const lastReset = new Date(Date.UTC(
    lastResetDate.getFullYear(),
    lastResetDate.getMonth(),
    lastResetDate.getDate()
  ));

  const daysDiff = Math.floor((today.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));
  const currentUsage = daysDiff >= 1 ? 0 : (profile.ai_usage_count || 0);
  const remaining = Math.max(0, FREE_DAILY_LIMIT - currentUsage);

  const resetDate = new Date(today);
  resetDate.setUTCDate(resetDate.getUTCDate() + 1);

  return {
    allowed: currentUsage < FREE_DAILY_LIMIT,
    remaining,
    limit: FREE_DAILY_LIMIT,
    resetDate,
    tier,
  };
}

/**
 * 增加 AI 使用次數（向後兼容）
 *
 * 注意：建議改用 checkAndConsumeAiQuota() 進行原子化操作。
 * 此函數保留給需要單獨遞增的場景。
 */
export async function incrementAiUsage(): Promise<{
  success: boolean;
  error?: string;
}> {
  const supabase = createServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('ai_usage_count, tier')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return { success: false, error: profileError.message };
  }

  const currentCount = profile?.ai_usage_count || 0;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ ai_usage_count: currentCount + 1 })
    .eq('id', user.id);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

/**
 * 獲取用戶配額信息（用於顯示）
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
  const usage = daysDiff >= 1 ? 0 : (profile.ai_usage_count || 0);

  const resetDate = new Date(today);
  resetDate.setUTCDate(resetDate.getUTCDate() + 1);

  return {
    tier,
    usage,
    limit: tier === 'pro' ? Infinity : FREE_DAILY_LIMIT,
    resetDate,
  };
}
