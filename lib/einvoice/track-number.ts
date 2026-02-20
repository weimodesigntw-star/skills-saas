/**
 * Invoice Track Number Management
 *
 * 管理電子發票字軌和號碼配置
 * - 取得下一個可用號碼
 * - 自動遞增 current_number
 * - 格式化為 AB-12345678 (prefix + 8-digit padded number)
 */

import { createServerClient } from '@/lib/supabase/server';
