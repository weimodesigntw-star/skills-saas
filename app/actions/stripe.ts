/**
 * Stripe Server Actions
 * 
 * 處理 Stripe 相關的 Server Actions
 */

'use server';

import { createServerClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/server';

/**
 * 創建 Stripe Checkout Session
 * 
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function createCheckoutSession(): Promise<
  { url: string } | { error: string }
> {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: 'Unauthorized' };
    }

    // 檢查 Price ID 是否設置
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      return { error: 'Stripe configuration error' };
    }

    // 獲取用戶的 profile 資料
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email, tier')
      .eq('id', user.id)
      .maybeSingle();

    // 如果已經是 Pro 用戶
    if (profile?.tier === 'pro') {
      return { error: 'You are already a Pro user' };
    }

    let customerId = profile?.stripe_customer_id;

    // 如果沒有 Stripe Customer ID，創建一個
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || profile?.email || undefined,
        metadata: {
          userId: user.id,
          supabase_user_id: user.id, // 保留舊的欄位名稱以確保向後兼容
        },
      });

      customerId = customer.id;

      // 保存到資料庫
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // 創建 Checkout Session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/dashboard/categories?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/dashboard/categories?canceled=true`,
      metadata: {
        userId: user.id,
        supabase_user_id: user.id, // 保留舊的欄位名稱以確保向後兼容
      },
    });

    return { url: session.url || '' };
  } catch (error) {
    console.error('[Create Checkout Session] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { error: errorMessage };
  }
}

/**
 * 創建 Stripe Customer Portal Session
 * 
 * 讓 Pro 用戶可以管理他們的訂閱（取消、更新付款方式等）
 * 
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function createCustomerPortalSession(): Promise<
  { url: string } | { error: string }
> {
  try {
    const supabase = createServerClient();
    
    // 1. 取得目前登入者
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: '請先登入' };
    }

    // 2. 從資料庫查詢 stripe_customer_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return { error: '找不到訂閱資訊' };
    }

    // 3. 請求 Stripe 建立管理頁面連結
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/dashboard/categories`, // 按「返回」後要去哪
    });

    return { url: session.url };
  } catch (error) {
    console.error('[Stripe Portal] Error:', error);
    const errorMessage = error instanceof Error ? error.message : '無法開啟管理頁面';
    return { error: errorMessage };
  }
}
