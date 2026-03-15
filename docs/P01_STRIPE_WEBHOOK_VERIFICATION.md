# P0-1｜Stripe Webhook 正式環境驗證

> 目標：確保正式環境的訂閱事件能正確觸發 `profiles.tier` 更新  
> 操作者：需能登入 Stripe Dashboard 與 Vercel 的人員

---

## Step 1｜確認 Vercel 環境變數

登入 **Vercel** → 專案 **skills-saas-fkpc** → **Settings** → **Environment Variables**，確認以下變數存在且為**正式值**（上線請用 live key，勿用測試用 `sk_test_`）：

| 變數 | 應為 |
|------|------|
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...`（Step 2 取得後填入） |
| `STRIPE_PRO_PRICE_ID` | `price_...`（Pro 方案 Price ID） |

> ⚠️ 若目前填的是 `sk_test_` / `pk_test_`，需換成 live key 並**重新部署**。

---

## Step 2｜在 Stripe Dashboard 設定 Webhook Endpoint

1. 進入 [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. 點 **Add endpoint**
3. **Endpoint URL** 填入（注意路徑為 `/api/stripe/webhook`）：
   ```
   https://skills-saas-fkpc.vercel.app/api/stripe/webhook
   ```
4. **監聽事件**至少選擇：
   - `checkout.session.completed`（結帳完成、升級 Pro）
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. 建立後，複製 **Signing secret**（`whsec_...`）
6. 回到 **Vercel** → Environment Variables → 將 `STRIPE_WEBHOOK_SECRET` 設為此值 → **Redeploy**

---

## Step 3｜驗證 Webhook 是否通

在 **Stripe Dashboard** → **Webhooks** → 點剛建立的 endpoint → **Send test webhook**，選擇 `customer.subscription.updated`，送出後確認：

- Stripe 顯示 **200 OK**
- **Vercel** → Deployments → 選擇最新部署 → **Functions** → 找到 `/api/stripe/webhook`，確認有收到該事件 log

---

## Step 4｜端對端測試（升級訂閱）

1. 用測試帳號在正式環境走一次「升級 Pro」流程
2. **Stripe Dashboard** → **Events** 確認事件已送出
3. **Supabase Dashboard** → **Table Editor** → `profiles` → 確認該使用者 `tier` 已更新為 `pro`

> 若 `tier` 沒更新，優先查 **Vercel Function log** 的錯誤訊息。

---

## 常見問題速查

| 症狀 | 可能原因 |
|------|----------|
| Stripe 顯示 `401` | `STRIPE_WEBHOOK_SECRET` 與 Stripe 該 endpoint 的 Signing secret 不符，重新複製並 Redeploy |
| Stripe 顯示 `500` | 查 Vercel Function log 具體錯誤，多為 DB 寫入或環境變數問題 |
| `tier` 沒更新 | Webhook 有收到但邏輯判斷有誤，查 `subscription.status` 是否為 `active` / `trialing` |
| 本地測試收不到 | 需用 `stripe listen --forward-to localhost:3000/api/stripe/webhook` 轉發，並用 CLI 顯示的 `whsec_...` 設入本機 `.env.local` |

---

## 相關文件

- 詳細設定與事件說明：`docs/STRIPE_WEBHOOK_VERCEL.md`
- 專案內 Webhook 實作：`app/api/stripe/webhook/route.ts`

---

驗證完成並勾選後，P0 即全部結案。
