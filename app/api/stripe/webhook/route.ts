/**
 * Stripe Webhook Handler
 *
 * 處理 Stripe 訂閱事件（支付成功、取消等）
 */

import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    logger.error('[Stripe Webhook] Missing signature');
    return new Response('Missing signature', { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // 🔒 安全修復：webhook secret 是必要的
  if (!webhookSecret) {
    logger.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not set. Rejecting request.');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error('[Stripe Webhook] Signature verification failed:', errorMessage);
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  logger.info('[Stripe Webhook] Received event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const userId = session.metadata?.userId || session.metadata?.supabase_user_id;

        if (!userId) {
          logger.error('[Stripe Webhook] Missing userId in metadata');
          return new Response(
            JSON.stringify({ error: 'Missing userId in metadata' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

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
          logger.error('[Stripe Webhook] Failed to update profile:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update profile' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }

        logger.info('[Stripe Webhook] User upgraded to Pro:', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer as string;

        const supabaseAdmin = createAdminClient();

        // 優先用 subscription_id 查找，找不到再用 customer_id
        let { data: profile, error: findError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (!profile && !findError) {
          const { data: profileByCustomer } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          profile = profileByCustomer;
        }

        if (!profile) {
          logger.error('[Stripe Webhook] Profile not found for subscription:', subscriptionId);
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            tier: 'free',
            stripe_subscription_id: null,
          })
          .eq('id', profile.id);

        if (updateError) {
          logger.error('[Stripe Webhook] Failed to downgrade profile:', updateError);
        } else {
          logger.info('[Stripe Webhook] User downgraded to Free:', profile.id);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        // 只有 'active' 或 'trialing' 狀態才視為 Pro
        const isActive = status === 'active' || status === 'trialing';
        const tier = isActive ? 'pro' : 'free';

        const supabaseAdmin = createAdminClient();

        let { data: profile, error: findError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .maybeSingle();

        if (!profile && !findError) {
          const { data: profileByCustomer } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();
          profile = profileByCustomer;
        }

        if (!profile) {
          logger.error('[Stripe Webhook] Profile not found for subscription:', subscriptionId);
          break;
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            tier,
            stripe_subscription_id: subscriptionId,
          })
          .eq('id', profile.id);

        if (updateError) {
          logger.error('[Stripe Webhook] Failed to update subscription:', updateError);
        } else {
          logger.info('[Stripe Webhook] Subscription updated:', { userId: profile.id, status, tier });
        }
        break;
      }

      default:
        logger.info('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    logger.error('[Stripe Webhook] Error processing event:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
