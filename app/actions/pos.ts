/**
 * POS Server Actions
 *
 * 處理 POS 模組的伺服器端操作：
 * - 獲取商品清單
 * - 獲取分類
 * - 建立訂單
 * - 獲取訂單歷史
 */

'use server';

import { createServerClient } from 'A/lib/supabase/server';