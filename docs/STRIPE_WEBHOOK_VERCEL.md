# Stripe Webhook 設定指南（Vercel 正式環境）

正式網址：**https://skills-saas-fkpc.vercel.app**

---

## 1. 專案內 Webhook Route ✅

- **路徑**：`app/api/stripe/webhook/route.ts`
- **狀態**：存在且完整
- **處理事件**：
  - `checkout.session.completed` — 升級用戶為 Pro、寫入 profiles
  - `customer.subscription.updated` — 依 status 更新 tier (active/trialing → pro)
  - `customer.subscription.deleted` — 降級為 free、清空 stripe_subscription_id
- **未處理事件**：其他事件會 log 並回傳 `200`，不影響訂閱同步

---

## 2. Vercel 環境變數檢查清單

在 [Vercel](https://vercel.com) → 專案 **skills-saas-fkpc** → **Settings** → **Environment Variables** 確認：

| 變數名稱 | 必填 | 說明 |
|----------|------|------|
| `STRIPE_SECRET_KEY` | ✅ | Stripe 秘密金鑰 (sk_live_... 或 sk_test_...) |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Webhook Signing Secret (whsec_...)，**需與 Stripe 上該 endpoint 一致** |
| `STRIPE_PRO_PRICE_ID` | ✅ | Pro 方案 Price ID (price_...)，用於 Checkout |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | 前端用 (pk_live_... 或 pk_test_...) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 專案 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Webhook 更新 profiles 用 |
| `NEXT_PUBLIC_APP_URL` | 建議 | 正式網址：`https://skills-saas-fkpc.vercel.app`（用於 Checkout return URL） |

**若缺少任一「必填」變數**：在 Vercel 新增後需 **Redeploy** 才會生效。

---

## 3. 在 Stripe Dashboard 更新 Webhook URL

1. 前往 [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. **若已有舊 endpoint**：
   - 點該 endpoint → **Update details**
   - 將 **Endpoint URL** 改為：  
     `https://skills-saas-fkpc.vercel.app/api/stripe/webhook`
   - 儲存
3. **若沒有 endpoint**：
   - 點 **Add endpoint**
   - **Endpoint URL**：`https://skills-saas-fkpc.vercel.app/api/stripe/webhook`
   - **Events to send** 至少勾選：
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - 儲存

---

## 4. 取得並更新 Webhook Signing Secret

1. 在 Stripe Webhooks 頁面，點進該 endpoint
2. 在 **Signing secret** 旁點 **Reveal**（若為新建 endpoint 會直接顯示）
3. 複製 `whsec_...` 的值
4. **更新兩處**：
   - **Vercel**：專案 → Settings → Environment Variables → 編輯 `STRIPE_WEBHOOK_SECRET`，貼上新的 `whsec_...` → **Redeploy**
   - **本機**：在專案根目錄 `.env.local` 中設定  
     `STRIPE_WEBHOOK_SECRET=whsec_...`  
     （本機測試 webhook 時使用）

---

## 5. 測試 Webhook

### 方法 A：Stripe Dashboard

1. Webhooks 頁 → 點你的 endpoint
2. 點 **Send test webhook**
3. 選 `checkout.session.completed` 或 `customer.subscription.updated`
4. 送出後看 **Recent deliveries**：應為 **200**，若失敗可點進去看回應內容

### 方法 B：Stripe CLI（本機轉發）

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

CLI 會輸出一個暫時的 `whsec_...`，本機 `.env.local` 用此值即可對本機轉發做測試。  
正式環境請以 Vercel 上的 endpoint 與 **步驟 3、4** 為準。

---

## 注意

- Webhook URL 未更新為正式網址前，付款成功後 **訂閱狀態不會寫入 Supabase**，用戶不會變 Pro。
- 每次在 Stripe 新增或更換 endpoint，都會產生新的 **Signing secret**，必須同步更新 Vercel 的 `STRIPE_WEBHOOK_SECRET` 並 Redeploy。
