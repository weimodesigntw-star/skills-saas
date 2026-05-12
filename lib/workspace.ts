/**
 * Workspace helper：取得當前 auth user 所屬的 workspace owner_id
 *
 * 背景：
 *   系統採 workspace 多帳號協作模式（見 supabase/migrations/052_workspace_members.sql）。
 *   所有業務表的 user_id 欄位代表「workspace owner」，不是建立者。
 *   - Owner 本人登入：ownerId === user.id
 *   - Member（共同協作者）登入：ownerId === 該 workspace 的 owner UID
 *   - 其他用戶（無 mapping）：fallback 為 user.id 自己，相當於獨立 workspace
 *
 * 使用情境：
 *   所有 server action / API route / RPC 呼叫中，凡是要過濾或寫入「公司業務資料」
 *   的 user_id 欄位，都應用此 helper 回傳的 ownerId，而非 user.id。
 *
 *   例外（保持個人化、繼續用 user.id）：
 *     - profiles 表（個人資料、訂閱、AI 額度）
 *     - shopping_carts 表（前台顧客購物車）
 *     - subscription / billing 相關 RPC（check_and_increment_ai_usage 等）
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * 回傳當前 auth user 所屬 workspace 的 owner_id。
 *
 * - 已登入：呼叫 SQL `resolve_workspace_owner()`，得到 mapping 對應的 owner_id；
 *   若 RPC 失敗或無 mapping，fallback 為 user.id
 * - 未登入：回傳 null
 */
export async function getWorkspaceOwnerId(
  supabase: SupabaseClient
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('resolve_workspace_owner');
  if (error) {
    console.error('[getWorkspaceOwnerId] resolve_workspace_owner RPC failed', error);
    return user.id;
  }
  return (data as string | null) ?? user.id;
}

/**
 * 同時取得 auth user 物件與 workspace owner_id。
 * 適用大多數 server action：需要 ownerId 過濾資料，且要 user.id / user.email 做稽核。
 */
export async function getAuthAndWorkspace(
  supabase: SupabaseClient
): Promise<{ user: User | null; ownerId: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, ownerId: null };

  const { data, error } = await supabase.rpc('resolve_workspace_owner');
  if (error) {
    console.error('[getAuthAndWorkspace] resolve_workspace_owner RPC failed', error);
    return { user, ownerId: user.id };
  }
  return { user, ownerId: (data as string | null) ?? user.id };
}
