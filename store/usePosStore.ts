/**
 * POS Store
 *
 * 使用 Zustand 管理 POS 模組的狀態：
 * - 購物車（商品清單）
 * - 金額計算（小計、稅額、折扣、總計）
 * - 發票資訊
 * - UI 狀態（結帳、掃碼器、分類等）
 */

import { create } from 'zustand';
import { calcTaxIncluded } from '@/lib/constants';