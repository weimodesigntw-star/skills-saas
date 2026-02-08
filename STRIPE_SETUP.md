# Stripe 支付整合設置指南

## 📋 概述

本文檔說明如何設置 Stripe 支付整合，讓用戶可以升級到 Pro 方案。

---

## 🔑 步驟 1：環境變數設置

### 已添加到 `.env.local`

```env
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_您的公開鑰匙...
STRIPE_SECRET_KEY=sk_test_您的秘密鑰匙...
STRIPE_PRO_PRICE_ID=price_您的產品價格ID...

# App URL (for Stripe redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Webhook Secret (will be set up later)
STRIPE_WEBHOOK_SECRET=whsec_您的Webhook密鑰...
```

### ⚠️ 重要提醒

1. **Price ID vs Product ID**：
   - 您提供的 `prod_Tw04prTQmxpN1e` 看起來是 **Product ID**（以 `prod_` 開頭）
   - Stripe 的 **Price ID** 通常以 `price_` 開頭
   - 如果這是 Product ID，您需要：
     - 在 Stripe Dashboard → Products → 點擊您的產品
     - 找到對應的 **Price**（價格）
     - 複製 **Price ID**（格式：`price_xxxxx`）

2. **測試環境**：
   - 目前使用的是 **Test Mode** 的 API keys（`pk_test_` 和 `sk_test_`）
   - 生產環境需要切換到 **Live Mode** keys

---

## 📦 步驟 2：安裝 Stripe SDK

執行以下命令安裝 Stripe Node.js SDK：

```bash
npm install stripe
```

---

## 🔧 步驟 3：創建 Stripe 工具函數

### 創建 `lib/stripe/server.ts`

```typescript
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});
```

---

## 🎯 步驟 4：創建 Checkout Session API

### 創建 `app/api/stripe/checkout/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 獲取或創建 Stripe Customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // 創建新的 Stripe Customer
      const customer = await stripe.customers.create({
        email: user.email || profile?.email,
        metadata: {
          supabase_user_id: user.id,
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
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/categories?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/categories?canceled=true`,
    });

    return new Response(
      JSON.stringify({ url: session.url }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
```

---

## 🔔 步驟 5：設置 Webhook（處理訂閱事件）

### 創建 `app/api/stripe/webhook/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { stripe } from '@/lib/stripe/server';
import { createServerClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Missing signature or webhook secret', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // 處理訂閱事件
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;

    // 更新用戶的 tier 為 'pro'
    const supabase = createServerClient();
    await supabase
      .from('profiles')
      .update({
        tier: 'pro',
        stripe_subscription_id: session.subscription as string,
      })
      .eq('stripe_customer_id', customerId);
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // 降級用戶為 'free'
    const supabase = createServerClient();
    await supabase
      .from('profiles')
      .update({
        tier: 'free',
        stripe_subscription_id: null,
      })
      .eq('stripe_customer_id', customerId);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

---

## 🌐 步驟 6：設置 Stripe Webhook（在 Stripe Dashboard）

1. 前往 [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. 點擊 "Add endpoint"
3. 輸入 Webhook URL：
   - **本地開發**：使用 [Stripe CLI](https://stripe.com/docs/stripe-cli) 轉發
   - **生產環境**：`https://yourdomain.com/api/stripe/webhook`
4. 選擇要監聽的事件：
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. 複製 **Signing secret**（格式：`whsec_xxxxx`）
6. 添加到 `.env.local`：
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxx
   ```

---

## 🧪 步驟 7：測試支付流程

### 使用 Stripe 測試卡號

- **成功**：`4242 4242 4242 4242`
- **需要 3D Secure**：`4000 0025 0000 3155`
- **拒絕**：`4000 0000 0000 0002`

其他測試資訊：
- **到期日**：任何未來日期（例如 `12/34`）
- **CVC**：任何 3 位數字（例如 `123`）
- **郵編**：任何 5 位數字（例如 `12345`）

---

## 📝 注意事項

1. **Price ID 確認**：
   - 請確認 `STRIPE_PRO_PRICE_ID` 是正確的 Price ID（`price_xxxxx`）
   - 如果目前是 Product ID，需要在 Stripe Dashboard 中找到對應的 Price ID

2. **環境變數**：
   - 確保所有環境變數都已正確設置
   - 生產環境需要切換到 Live Mode keys

3. **Webhook 設置**：
   - 本地開發需要使用 Stripe CLI 轉發 webhook
   - 生產環境需要設置公開的 webhook URL

4. **安全性**：
   - 永遠不要將 `STRIPE_SECRET_KEY` 暴露在前端代碼中
   - 所有 Stripe 操作都應該在 Server Side 執行

---

## ✅ 完成檢查清單

- [ ] 安裝 `stripe` npm 套件
- [ ] 確認 `.env.local` 中的 Stripe 配置
- [ ] 確認 `STRIPE_PRO_PRICE_ID` 是正確的 Price ID
- [ ] 創建 `lib/stripe/server.ts`
- [ ] 創建 `app/api/stripe/checkout/route.ts`
- [ ] 創建 `app/api/stripe/webhook/route.ts`
- [ ] 設置 Stripe Webhook
- [ ] 測試支付流程

---

**完成後，用戶就可以通過 Stripe 升級到 Pro 方案了！** 🎉
