/**
 * Stripe Webhook Handler
 * 
 * 處理 Stripe 訂閱事件（支付成功、取消等）
 */

import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[Stripe Webhook] Missing signature');
    return new Response('Missing signature', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not set');
    // 在開發環境中，如果沒有設置 webhook secret，我們仍然可以處理事件（不安全，僅用於開發）
    if (process.env.NODE_ENV === 'production') {
      return new Response('Webhook secret not configured', { status: 500 });
    }
  }

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } else {
      // 開發環境：直接解析 JSON（不安全，僅用於開發）
      console.warn('[Stripe Webhook] Running in development mode without webhook secret verification');
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Stripe Webhook] Signature verification failed:', errorMessage);
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  console.log('[Stripe Webhook] Received event:', event.type);

  // 處理不同的事件類型
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        // 優先使用 userId，如果沒有則使用 supabase_user_id（向後兼容）
        const userId = session.metadata?.userId || session.metadata?.supabase_user_id;

        console.log('[Stripe Webhook] Checkout completed:', {
          sessionId: session.id,
          customerId,
          subscriptionId,
          userId,
        });

        if (!userId) {
          console.error('[Stripe Webhook] Missing userId in metadata');
          return new Response(
            JSON.stringify({ error: 'Missing userId in metadata' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // 使用 Admin Client 繞過 RLS 更新用戶的 tier 為 'pro'
        const supabaseAdmin = createAdminClient();
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            tier: 'pro',
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', userId);

        if (updateError) {
          console.error('[Stripe Webhook] Failed to update profile:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update profile' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        console.log('[Stripe Webhook] User upgraded to Pro:', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer as string;

        console.log('[Stripe Webhook] Subscription deleted:', {
          subscriptionId,
          customerId,
        });

        // 使用 Admin Client 降級用戶為 'free'
        // 優先使用 stripe_subscription_id 查找（更準確），如果找不到則使用 stripe_customer_id
        const supabaseAdmin = createAdminClient();
        
        // 先嘗試用 subscription_id 查找
        let { data: profile, error: findError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        // 如果找不到，嘗試用 customer_id 查找
        if (!profile && !findError) {
          const { data: profileByCustomer } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          profile = profileByCustomer;
        }

        if (!profile) {
          console.error('[Stripe Webhook] Could not find user profile for subscription:', subscriptionId);
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            tier: 'free',
            stripe_subscription_id: null, // 清除訂閱 ID
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('[Stripe Webhook] Failed to downgrade profile:', updateError);
        } else {
          console.log('[Stripe Webhook] User downgraded to Free:', profile.id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const cancelAtPeriodEnd = subscription.cancel_at_period_end;

        console.log('[Stripe Webhook] Subscription updated:', {
          subscriptionId,
          customerId,
          status,
          cancelAtPeriodEnd,
        });

        // 使用 Admin Client 根據訂閱狀態更新用戶 tier
        const supabaseAdmin = createAdminClient();
        
        // 訂閱狀態說明：
        // - 'active': 正常運作中
        // - 'past_due': 扣款失敗，但還在寬限期內
        // - 'canceled': 已取消（通常在週期結束時）
        // - 'unpaid': 未付款
        // - 'incomplete': 初始狀態
        // - 'incomplete_expired': 初始狀態過期
        // - 'trialing': 試用期
        // - 'paused': 暫停
        
        // 只有 'active' 或 'trialing' 狀態才視為 Pro
        const isActive = status === 'active' || status === 'trialing';
        const tier = isActive ? 'pro' : 'free';

        // 如果用戶設定了「在週期結束時取消」(cancel_at_period_end = true)
        // 此時 status 可能還是 'active'，但會在週期結束時自動變為 'canceled'
        // 我們這裡採用「嚴格模式」：只要不是 active/trialing，就降級為 free
        // 這樣可以確保扣款失敗時立即降級
        
        // 優先使用 subscription_id 查找（更準確）
        let { data: profile, error: findError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        // 如果找不到，嘗試用 customer_id 查找
        if (!profile && !findError) {
          const { data: profileByCustomer } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          profile = profileByCustomer;
        }

        if (!profile) {
          console.error('[Stripe Webhook] Could not find user profile for subscription:', subscriptionId);
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            tier,
            stripe_subscription_id: subscriptionId,
            // 如果降級為 free，保留 stripe_customer_id（用戶可能之後會重新訂閱）
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('[Stripe Webhook] Failed to update subscription:', updateError);
        } else {
          console.log('[Stripe Webhook] Subscription status updated:', { 
            userId: profile.id, 
            subscriptionId, 
            status, 
            tier,
            cancelAtPeriodEnd: cancelAtPeriodEnd ? 'Will cancel at period end' : 'Active',
          });
        }
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
