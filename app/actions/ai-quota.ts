'use server';

import { createServerClient } from '@/lib/supabase/server';
import { FREE_DAILY_LIMIT } from '@/lib/config/subscription';

/** Free 每日上限來自 config；Pro 無限制 */
const QUOTA_LIMIT = { free: FREE_DAILY_LIMIT, pro: -1 } as const;

export type AiQuotaResult = {
  used: number;
  limit: number;
  remaining: number;
  tier: string;
};

export async function fetchAiQuota(): Promise<AiQuotaResult | null> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, ai_usage_count, last_reset_date')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  const tier = (profile.tier === 'pro' ? 'pro' : 'free') as 'free' | 'pro';
  const limit = QUOTA_LIMIT[tier];

  if (tier === 'pro') {
    return { used: 0, limit: -1, remaining: -1, tier: 'pro' };
  }

  const resetAt = profile.last_reset_date ? new Date(profile.last_reset_date) : new Date(0);
  const now = new Date();
  const isNewDay = now.toDateString() !== resetAt.toDateString();
  const used = isNewDay ? 0 : (profile.ai_usage_count ?? 0);
  const remaining = Math.max(limit - used, 0);

  return { used, limit, remaining, tier: 'free' };
}
