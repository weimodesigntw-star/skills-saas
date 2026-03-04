'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/lib/supabase/server';
import { calcTaxIncluded } from '@/lib/constants';

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

/**
 * 從購物車建立訂單
 */
export async function createOrderFromCart(paymentMethod: string) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('請先登入');

  const admin = createAdminClient();

  // 1. Get cart items with product info
  const cartItems = await getCart();
  if (cartItems.length === 0) throw new Error('購物車是空的');

  // 2. Validate stock
  for (const item of cartItems) {
    if (item.quantity > item.stock) {
      throw new Error(`「${item.name}」庫存不足（剩餘 ${item.stock} 件）`);
    }
  }

  // 3. Calculate totals
  const totalCalc = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const taxAmount = calcTaxIncluded(totalCalc);

  // 4. Payment method mapping
  const paymentMethodMap: Record<string, string> = {
    cash: 'CASH',
    credit_card: 'CREDIT',
    line_pay: 'LINEPAY',
    easy_card: 'EASYCARD',
  };
  const dbPaymentMethod = paymentMethodMap[paymentMethod] ?? paymentMethod.toUpperCase();

  // 5. Generate order number
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderNum = `WEB-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 6. Item description
  const itemDesc = cartItems
    .map((i) => `${i.name} x${i.quantity}`)
    .join(', ');

  // 7. Create order (compatible with original schema: order_no/amount/items/item_desc/email + newer columns)
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      order_no: orderNum,
      order_number: orderNum,
      status: 'pending',
      payment_method: dbPaymentMethod,
      amount: totalCalc,
      items: cartItems.map((i) => ({
        product_id: i.product_id,
        name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
      })),
      item_desc: itemDesc,
      email: user.email ?? '',
      subtotal: totalCalc - taxAmount,
      tax_amount: taxAmount,
      discount_amount: 0,
      total_amount: totalCalc,
      note: itemDesc,
      metadata: { source: 'web_shop' },
    })
    .select('id, order_number, order_no')
    .single();

  if (orderErr || !order) {
    console.error('Order insert error:', orderErr);
    throw new Error(orderErr?.message ?? '建立訂單失敗');
  }

  // 8. Create order items
  await admin.from('order_items').insert(
    cartItems.map((i) => ({
      order_id: order.id,
      product_id: i.product_id,
      product_name: i.name,
      product_barcode: null,
      quantity: i.quantity,
      unit_price: i.price,
      subtotal: i.price * i.quantity,
      metadata: {},
    }))
  );

  // 9. Deduct stock
  for (const item of cartItems) {
    const { data: p } = await admin
      .from('products')
      .select('stock')
      .eq('id', item.product_id)
      .single();
    if (p) {
      await admin
        .from('products')
        .update({ stock: Math.max(0, p.stock - item.quantity) })
        .eq('id', item.product_id);
    }
  }

  // 10. Clear cart
  await admin
    .from('shopping_carts')
    .delete()
    .eq('user_id', user.id);

  revalidatePath('/cart');
  revalidatePath('/shop');
  revalidatePath('/dashboard/products');

  return {
    orderId: order.id,
    orderNumber: order.order_number || order.order_no || orderNum,
  };
}
