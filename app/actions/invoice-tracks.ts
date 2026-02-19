'use server';

/**
 * Server Actions for Invoice Track Management
 *
 * Wraps the track-number functions to handle server-only operations
 * from client components
 */

import { createServerClient } from '@/lib/supabase/server';
import {
  getUserInvoiceTracks as getTracksFromLib,
  addInvoiceTrack as addTrackFromLib,
  activateInvoiceTrack as activateTrackFromLib,
  deactivateInvoiceTrack as deactivateTrackFromLib,
  InvoiceTrackNumber,
} from '@/lib/einvoice/track-number';

/**
 * Get all invoice tracks for the authenticated user
 */
export async function getUserTracks(): Promise<InvoiceTrackNumber[]> {
  try {
    // Get the authenticated user's ID from the server
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('未授權的請求');
    }

    // Fetch tracks for this user
    const tracks = await getTracksFromLib(user.id);
    return tracks;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('取得字軌列表失敗');
  }
}

/**
 * Add a new invoice track
 */
export async function addTrack(
  prefix: string,
  yearMonth: string,
  startNumber: number,
  endNumber: number
): Promise<InvoiceTrackNumber> {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('未授權的請求');
    }

    const track = await addTrackFromLib(user.id, prefix, yearMonth, startNumber, endNumber);
    return track;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('新增字軌失敗');
  }
}

/**
 * Activate an invoice track
 */
export async function activateTrack(trackId: string): Promise<void> {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('未授權的請求');
    }

    await activateTrackFromLib(trackId);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('啟用字軌失敗');
  }
}

/**
 * Deactivate an invoice track
 */
export async function deactivateTrack(trackId: string): Promise<void> {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error('未授權的請求');
    }

    await deactivateTrackFromLib(trackId);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('停用字軌失敗');
  }
}
