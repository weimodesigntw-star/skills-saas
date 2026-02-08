/**
 * Stripe Checkout Session API
 * 
 * 創建 Stripe Checkout Session，讓用戶升級到 Pro 方案
 */

import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[Stripe Checkout] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 檢查 Price ID 是否設置
    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) {
      console.error('[Stripe Checkout] STRIPE_PRO_PRICE_ID is not set');
      return new Response(
        JSON.stringify({ error: 'Stripe configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 獲取用戶的 profile 資料
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email, tier')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Stripe Checkout] Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 如果已經是 Pro 用戶，直接返回錯誤
    if (profile?.tier === 'pro') {
      return new Response(
        JSON.stringify({ error: 'You are already a Pro user' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let customerId = profile?.stripe_customer_id;

    // 如果沒有 Stripe Customer ID，創建一個
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: user.email || profile?.email || undefined,
          metadata: {
            supabase_user_id: user.id,
          },
        });

        customerId = customer.id;

        // 保存到資料庫
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);

        if (updateError) {
          console.error('[Stripe Checkout] Failed to save customer ID:', updateError);
          // 繼續執行，因為 Stripe Customer 已經創建
        }
      } catch (stripeError) {
        console.error('[Stripe Checkout] Failed to create Stripe customer:', stripeError);
        return new Response(
          JSON.stringify({ error: 'Failed to create customer' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
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
        supabase_user_id: user.id,
      },
    });

    console.log('[Stripe Checkout] Session created:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Stripe Checkout] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session', message: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
