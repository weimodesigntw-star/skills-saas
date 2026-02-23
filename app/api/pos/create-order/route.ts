/**
 * POS Create Order API Route
 *
 * POST /api/pos/create-order
 * 直接使用 Supabase 查詢建立訂單（不使用 RPC，以相容不同 schema）
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function POST(request: Request) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentMethod, items, discountAmount } = body as {
      paymentMethod: string;
      items: { product_id: string; quantity: number; unit_price: number }[];
      discountAmount?: number;
    };

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '購物車為空' }, { status: 400 });
    }

    // 付款方式對應（POS 值 → DB check constraint 值）
    const paymentMethodMap: Record<string, string> = {
      cash: 'CASH',
      credit_card: 'CREDIT',
      line_pay: 'LINEPAY',
      easy_card: 'EASYCARD',
    };
    const dbPaymentMethod = paymentMethodMap[paymentMethod] ?? paymentMethod.toUpperCase();

    const discount = discountAmount ?? 0;
    const totalCalc = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
    const total = Math.max(0, totalCalc - discount);
    const taxAmount = Math.round((total * 5) / 105);

    // 生成訂單編號
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const orderNum = `POS-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 查詢商品名稱（提前查詢，用於 item_desc）
    const pIds = items.map((i) => i.product_id);
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, barcode')
      .in('id', pIds);
    const pMap = new Map(
      (prods ?? []).map((p: { id: string; name: string; barcode: string | null }) => [p.id, p])
    );

    // 組合 item_desc（商品摘要描述）
    const itemDesc = items
      .map((i) => `${pMap.get(i.product_id)?.name ?? '商品'} x${i.quantity}`)
      .join(', ');

    // 建立訂單（相容原始 schema 的 order_no/amount/items/item_desc 與新增的 order_number/total_amount 等欄位）
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        order_no: orderNum,
        order_number: orderNum,
        status: 'paid',
        payment_method: dbPaymentMethod,
        amount: total,
        items: items.map((i) => ({
          product_id: i.product_id,
          name: pMap.get(i.product_id)?.name ?? '商品',
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        item_desc: itemDesc,
        email: user.email ?? '',
        subtotal: total - taxAmount,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: total,
        metadata: {},
      })
      .select('id, order_number, order_no')
      .single();

    if (orderErr || !order) {
      console.error('Order insert error:', orderErr);
      return NextResponse.json(
        { error: orderErr?.message ?? '建立訂單失敗' },
        { status: 500 }
      );
    }

    // 寫入訂單明細
    const { error: itemsErr } = await supabase.from('order_items').insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        product_name: pMap.get(i.product_id)?.name ?? '未知商品',
        product_barcode: pMap.get(i.product_id)?.barcode ?? null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.unit_price * i.quantity,
        metadata: {},
      }))
    );

    if (itemsErr) {
      console.error('Order items insert error:', itemsErr);
    }

    // 扣減庫存
    for (const i of items) {
      const { data: p } = await supabase
        .from('products')
        .select('stock')
        .eq('id', i.product_id)
        .single();
      if (p) {
        await supabase
          .from('products')
          .update({ stock: Math.max(0, p.stock - i.quantity) })
          .eq('id', i.product_id);
      }
    }

    revalidatePath('/dashboard/pos');
    revalidatePath('/dashboard/products');

    const finalOrderNumber = order.order_number || order.order_no || orderNum;

    return NextResponse.json({
      orderId: order.id,
      orderNumber: finalOrderNumber,
    });
  } catch (error) {
    console.error('Create order exception:', error);
    const message = error instanceof Error ? error.message : '建立訂單失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
