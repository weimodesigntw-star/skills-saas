'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { calcTaxIncluded } from '@/lib/constants';
import type { CheckoutFormValues } from '@/lib/schemas/checkout';

export interface CartItemWithProduct {
  id: string;
  product_id: string;
  quantity: number;
  name: string;
  price: number;
  stock: number;
  image_url: string | null;
}

/**
 * 取得目前用戶的購物車
 */
export async function getCart(): Promise<CartItemWithProduct[]> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();

  const { data, error } = await admin
    .from('shopping_carts')
    .select('id, product_id, quantity, products(name, price, stock, image_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    // Fallback: table might not exist yet
    console.error('getCart error:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    quantity: item.quantity,
    name: item.products?.name || '未知商品',
    price: item.products?.price || 0,
    stock: item.products?.stock || 0,
    image_url: item.products?.image_url || null,
  }));
}

/**
 * 取得購物車數量（用於 badge 顯示）
 */
export async function getCartCount(): Promise<number> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const admin = createAdminClient();

  const { count, error } = await admin
    .from('shopping_carts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (error) return 0;
  return count || 0;
}

/**
 * 加入購物車
 */
export async function addToCart(productId: string, quantity: number = 1) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const admin = createAdminClient();

  // Check if item already in cart
  const { data: existing } = await admin
    .from('shopping_carts')
    .select('id, quantity')
    .eq('user_id', user.id)
    .eq('product_id', productId)
    .single();

  if (existing) {
    // Update quantity
    const { error } = await admin
      .from('shopping_carts')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id);

    if (error) throw new Error(error.message);
  } else {
    // Insert new item
    const { error } = await admin
      .from('shopping_carts')
      .insert({
        user_id: user.id,
        product_id: productId,
        quantity,
      });

    if (error) throw new Error(error.message);
  }

  revalidatePath('/cart');
  revalidatePath('/shop');
  return { success: true };
}

/**
 * 更新購物車項目數量
 */
export async function updateCartItem(productId: string, quantity: number) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const admin = createAdminClient();

  if (quantity <= 0) {
    return removeFromCart(productId);
  }

  const { error } = await admin
    .from('shopping_carts')
    .update({ quantity })
    .eq('user_id', user.id)
    .eq('product_id', productId);

  if (error) throw new Error(error.message);

  revalidatePath('/cart');
  return { success: true };
}

/**
 * 移除購物車項目
 */
export async function removeFromCart(productId: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const admin = createAdminClient();

  const { error } = await admin
    .from('shopping_carts')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);

  if (error) throw new Error(error.message);

  revalidatePath('/cart');
  return { success: true };
}

/**
 * 清空購物車
 */
export async function clearCart() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const admin = createAdminClient();

  const { error } = await admin
    .from('shopping_carts')
    .delete()
    .eq('user_id', user.id);

  if (error) throw new Error(error.message);

  revalidatePath('/cart');
  return { success: true };
}

/** Guest 購物車項目（用於登入後合併） */
export type GuestCartItem = {
  product_id: string;
  quantity: number;
  name?: string;
  price?: number;
  stock?: number;
  image_url?: string | null;
};

/**
 * 登入後將 localStorage 的 guest 購物車合併到 DB
 */
export async function mergeGuestCart(userId: string, guestItems: GuestCartItem[]) {
  if (guestItems.length === 0) return;
  const admin = createAdminClient();
  for (const item of guestItems) {
    const { data: existing } = await admin
      .from('shopping_carts')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('product_id', item.product_id)
      .single();
    const qty = Math.max(1, item.quantity || 1);
    if (existing) {
      await admin
        .from('shopping_carts')
        .update({ quantity: existing.quantity + qty })
        .eq('id', existing.id);
    } else {
      await admin.from('shopping_carts').insert({
        user_id: userId,
        product_id: item.product_id,
        quantity: qty,
      });
    }
  }
  revalidatePath('/cart');
}

/**
 * 從購物車建立訂單（P2-2：改用 create_pos_order RPC，防超賣 + 寫入顧客資料）
 */
export async function createOrderFromCart(
  formData: CheckoutFormValues
): Promise<{ orderId: string; orderNumber: string } | { error: string }> {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '請先登入' };

  const cartItems = await getCart();
  if (cartItems.length === 0) return { error: '購物車是空的' };

  const pItems = cartItems.map((i) => ({
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.price,
  }));

  const noteParts: string[] = [`地址：${formData.address}`];
  if (formData.note?.trim()) noteParts.push(`備註：${formData.note.trim()}`);
  const fullNote = noteParts.join('\n');

  const { data: orderId, error } = await supabase.rpc('create_pos_order', {
    p_user_id: user.id,
    p_payment_method: formData.paymentMethod,
    p_items: pItems,
    p_discount_amount: 0,
    p_note: fullNote,
    p_customer_name: formData.customerName,
    p_customer_phone: formData.customerPhone,
  });

  if (error) {
    if (error.message?.includes('庫存不足')) {
      return { error: '部分商品庫存不足，請返回購物車確認' };
    }
    console.error('create_pos_order error:', error);
    return { error: error.message || '訂單建立失敗，請稍後再試' };
  }

  if (!orderId) return { error: '訂單建立失敗' };

  const admin = createAdminClient();
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number')
    .eq('id', orderId)
    .single();

  await admin.from('shopping_carts').delete().eq('user_id', user.id);

  revalidatePath('/cart');
  revalidatePath('/shop');
  revalidatePath('/dashboard/products');

  return {
    orderId: order?.id ?? orderId,
    orderNumber: order?.order_number ?? String(orderId),
  };
}
