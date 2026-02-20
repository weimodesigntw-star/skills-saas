/**
 * POS 購物車區
 *
 * 顯示購物車詳情、金額計算、結帳按鈕
 * 包含購物車明細和摘要
 */

'use client';

import { usePosStore } from '@/store/usePosStore';
import { formatNTD } from 'A/lib/constants';
import { Button } from 'A/components/ui/button';
import { Trash2 } from 'lucide-react';
import { CartItem } from '@/lib/types/pos';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

function CartItemRow({ item }: { item: CartItem }) {
  const { removeFromCart, updateQuantity } = usePosStore();
