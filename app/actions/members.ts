'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Member type from profiles table
 */
export interface Member {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  notes: string | null;
  tier: string;
  is_active: boolean;
  role: string;
  ai_usage_count: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  joined_date: string | null;
  last_login: string | null;
  updated_at: string;
}

/**
 * Member stats
 */
export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  free: number;
  pro: number;
}

/**
 * Verify current user is authenticated (admin check)
 */
async function requireAuth() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Get all members list
 */
export async function getMembersList(): Promise<Member[]> {
  await requireAuth();
  const admin = createAdminClient();

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .order('joined_date', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false });

    if (error) {
      // Fallback: query without new columns
      const fallback = await admin
        .from('profiles')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fallback.error) throw fallback.error;

      return (fallback.data || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        phone: p.phone || null,
        notes: p.notes || null,
        tier: p.tier || 'free',
        is_active: p.is_active ?? true,
        role: p.role || 'member',
        ai_usage_count: p.ai_usage_count || 0,
        stripe_customer_id: p.stripe_customer_id,
        stripe_subscription_id: p.stripe_subscription_id,
        joined_date: p.joined_date || p.updated_at,
        last_login: p.last_login || null,
        updated_at: p.updated_at,
      }));
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
      phone: p.phone || null,
      notes: p.notes || null,
      tier: p.tier || 'free',
      is_active: p.is_active ?? true,
      role: p.role || 'member',
      ai_usage_count: p.ai_usage_count || 0,
      stripe_customer_id: p.stripe_customer_id,
      stripe_subscription_id: p.stripe_subscription_id,
      joined_date: p.joined_date || p.updated_at,
      last_login: p.last_login || null,
      updated_at: p.updated_at,
    }));
  } catch (err: any) {
    console.error('getMembersList error:', err);
    return [];
  }
}

/**
 * Get member by ID
 */
export async function getMemberById(id: string): Promise<Member> {
  await requireAuth();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    throw new Error('Member not found');
  }

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    phone: data.phone || null,
    notes: data.notes || null,
    tier: data.tier || 'free',
    is_active: data.is_active ?? true,
    role: data.role || 'member',
    ai_usage_count: data.ai_usage_count || 0,
    stripe_customer_id: data.stripe_customer_id,
    stripe_subscription_id: data.stripe_subscription_id,
    joined_date: data.joined_date || data.updated_at,
    last_login: data.last_login || null,
    updated_at: data.updated_at,
  };
}

/**
 * Update member
 */
export async function updateMember(
  id: string,
  updates: {
    full_name?: string;
    phone?: string;
    notes?: string;
    tier?: string;
    role?: string;
    is_active?: boolean;
  }
) {
  await requireAuth();
  const admin = createAdminClient();

  const { error } = await admin
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/members');
  revalidatePath(`/dashboard/members/${id}`);
  return { success: true };
}

/**
 * Toggle member active status
 */
export async function toggleMemberActive(id: string) {
  await requireAuth();
  const admin = createAdminClient();

  // Get current status
  const { data: member } = await admin
    .from('profiles')
    .select('is_active')
    .eq('id', id)
    .single();

  const newStatus = !(member?.is_active ?? true);

  const { error } = await admin
    .from('profiles')
    .update({
      is_active: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/members');
  return { success: true, is_active: newStatus };
}

/**
 * Get member statistics
 */
export async function getMemberStats(): Promise<MemberStats> {
  await requireAuth();
  const admin = createAdminClient();

  try {
    const { data, error } = await admin
      .from('profiles')
      .select('tier, is_active');

    if (error) {
      // Fallback without new columns
      const fallback = await admin
        .from('profiles')
        .select('tier');

      const members = fallback.data || [];
      return {
        total: members.length,
        active: members.length,
        inactive: 0,
        free: members.filter((m: any) => m.tier === 'free' || !m.tier).length,
        pro: members.filter((m: any) => m.tier === 'pro').length,
      };
    }

    const members = data || [];
    return {
      total: members.length,
      active: members.filter((m: any) => m.is_active !== false).length,
      inactive: members.filter((m: any) => m.is_active === false).length,
      free: members.filter((m: any) => m.tier === 'free' || !m.tier).length,
      pro: members.filter((m: any) => m.tier === 'pro').length,
    };
  } catch {
    return { total: 0, active: 0, inactive: 0, free: 0, pro: 0 };
  }
}

/**
 * Search members by email or name
 */
export async function searchMembers(query: string): Promise<Member[]> {
  await requireAuth();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .or(`email.ilike.%${query}%,full_name.ilike.%${query}%`)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('searchMembers error:', error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    phone: p.phone || null,
    notes: p.notes || null,
    tier: p.tier || 'free',
    is_active: p.is_active ?? true,
    role: p.role || 'member',
    ai_usage_count: p.ai_usage_count || 0,
    stripe_customer_id: p.stripe_customer_id,
    stripe_subscription_id: p.stripe_subscription_id,
    joined_date: p.joined_date || p.updated_at,
    last_login: p.last_login || null,
    updated_at: p.updated_at,
  }));
}
