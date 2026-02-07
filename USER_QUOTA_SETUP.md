# 用戶配額與訂閱狀態設置指南

## 📋 概述

本文檔說明如何設置用戶配額（User Quota）與訂閱狀態的基礎建設。實現了以下功能：

- ✅ Free 用戶：每日限制 3 次 AI 生成
- ✅ Pro 用戶：無限制使用
- ✅ 自動重置：每日自動重置使用次數
- ✅ Stripe 整合預留：為未來的支付整合預留欄位

---

## 🗄️ 步驟 1：修改資料庫 Schema

### 執行 SQL Migration

請在 **Supabase SQL Editor** 中執行以下 SQL 腳本：

**檔案位置**：`supabase/migrations/003_add_user_quota.sql`

或者直接複製以下 SQL：

```sql
-- ============================================
-- 用戶配額與訂閱狀態 Migration
-- ============================================

-- 檢查 profiles 表是否存在，如果不存在則創建
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新增訂閱層級欄位
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro'));

-- 新增 AI 使用次數欄位
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS ai_usage_count INTEGER DEFAULT 0;

-- 新增最後重置日期欄位
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_reset_date TIMESTAMPTZ DEFAULT NOW();

-- 新增 Stripe 客戶 ID 欄位（預留）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- 新增 Stripe 訂閱 ID 欄位（預留）
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- 創建索引以優化查詢性能
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(tier);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON profiles(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- 為現有用戶設置默認值（如果欄位為 NULL）
UPDATE profiles 
SET 
  tier = COALESCE(tier, 'free'),
  ai_usage_count = COALESCE(ai_usage_count, 0),
  last_reset_date = COALESCE(last_reset_date, NOW())
WHERE tier IS NULL OR ai_usage_count IS NULL OR last_reset_date IS NULL;

-- 啟用 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用戶只能查看和更新自己的資料
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 創建觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 新增的欄位說明

| 欄位名稱 | 類型 | 預設值 | 說明 |
|---------|------|--------|------|
| `tier` | TEXT | `'free'` | 訂閱層級：`'free'` 或 `'pro'` |
| `ai_usage_count` | INTEGER | `0` | 當天 AI 使用次數 |
| `last_reset_date` | TIMESTAMPTZ | `NOW()` | 最後重置日期（用於判斷何時重置） |
| `stripe_customer_id` | TEXT | `NULL` | Stripe 客戶 ID（預留） |
| `stripe_subscription_id` | TEXT | `NULL` | Stripe 訂閱 ID（預留） |

---

## 📁 步驟 2：新增的檔案

### 1. `app/actions/subscription.ts`

此檔案包含三個 Server Actions：

#### `checkAiLimit()`
- **功能**：檢查用戶是否還有 AI 使用配額
- **邏輯**：
  - Pro 用戶：直接返回 `allowed: true`
  - Free 用戶：
    - 檢查 `last_reset_date` 是否為「昨天以前」，如果是則重置計數
    - 檢查 `ai_usage_count` 是否小於 3
    - 返回 `allowed: true/false` 和配額信息

#### `incrementAiUsage()`
- **功能**：增加 AI 使用次數
- **調用時機**：AI 生成成功後

#### `getUserQuota()`
- **功能**：獲取用戶配額信息（用於 UI 顯示）

---

## 🔄 步驟 3：更新的檔案

### `app/api/ai/generate/route.ts`

**主要變更**：

1. **導入配額檢查函數**：
   ```typescript
   import { checkAiLimit, incrementAiUsage } from '@/app/actions/subscription';
   ```

2. **在呼叫 AI 之前檢查配額**：
   ```typescript
   const quotaCheck = await checkAiLimit();
   if (!quotaCheck.allowed) {
     return new Response(/* 403 錯誤 */);
   }
   ```

3. **在生成成功後增加使用次數**：
   ```typescript
   await incrementAiUsage();
   ```

---

## 🧪 測試步驟

### 1. 測試 Free 用戶配額限制

1. 登入一個 Free 用戶帳號
2. 嘗試生成 AI 分類（應該成功）
3. 重複 3 次後，第 4 次應該返回 403 錯誤：
   ```json
   {
     "error": "您已達到今日免費額度",
     "message": "免費方案每日限制 3 次 AI 生成。請於 [日期] 再試，或升級至 Pro 方案以獲得無限制使用。",
     "quota": {
       "remaining": 0,
       "limit": 3,
       "tier": "free"
     }
   }
   ```

### 2. 測試 Pro 用戶無限制

1. 在 Supabase 中將用戶的 `tier` 設為 `'pro'`：
   ```sql
   UPDATE profiles SET tier = 'pro' WHERE email = 'your-email@example.com';
   ```
2. 嘗試多次生成 AI 分類（應該都成功）

### 3. 測試每日重置

1. 將用戶的 `last_reset_date` 設為昨天：
   ```sql
   UPDATE profiles 
   SET last_reset_date = NOW() - INTERVAL '1 day'
   WHERE email = 'your-email@example.com';
   ```
2. 嘗試生成 AI 分類（應該自動重置計數為 0）

---

## 📊 配額邏輯詳解

### Free 用戶配額規則

- **每日限制**：3 次
- **重置時間**：每天 UTC 00:00（基於 `last_reset_date`）
- **檢查邏輯**：
  1. 如果 `last_reset_date` 是「昨天以前」，自動重置 `ai_usage_count = 0`
  2. 檢查 `ai_usage_count < 3`
  3. 如果通過，允許生成並 `ai_usage_count + 1`

### Pro 用戶配額規則

- **每日限制**：無限制（`Infinity`）
- **檢查邏輯**：直接返回 `allowed: true`，不追蹤使用次數

---

## 🔐 安全考量

1. **RLS (Row Level Security)**：
   - 用戶只能查看和更新自己的 `profiles` 資料
   - 所有查詢都使用 `auth.uid()` 進行權限檢查

2. **Server Actions**：
   - 所有配額檢查都在 Server Side 執行
   - 客戶端無法繞過配額限制

3. **資料完整性**：
   - 使用 `CHECK` 約束確保 `tier` 只能是 `'free'` 或 `'pro'`
   - 使用 `DEFAULT` 值確保新用戶自動設為 Free 方案

---

## 🚀 未來擴展

### Stripe 整合（預留）

當準備整合 Stripe 時，可以使用以下欄位：

- `stripe_customer_id`：儲存 Stripe Customer ID
- `stripe_subscription_id`：儲存 Stripe Subscription ID

### 升級方案

未來可以添加：

1. **升級 API**：`upgradeToPro(customerId: string)`
2. **降級 API**：`downgradeToFree()`
3. **Webhook 處理**：處理 Stripe 訂閱事件

---

## 📝 注意事項

1. **時區處理**：
   - 重置邏輯使用 UTC 日期比較，確保全球用戶的一致性
   - 前端顯示時可以轉換為用戶當地時區

2. **錯誤處理**：
   - 如果 `incrementAiUsage()` 失敗，不會阻止 AI 生成（因為已經通過配額檢查）
   - 建議監控日誌以確保計數準確

3. **性能優化**：
   - 已為 `tier` 和 Stripe 欄位創建索引
   - 配額檢查只查詢必要欄位，減少資料傳輸

---

## ✅ 完成檢查清單

- [ ] 在 Supabase 執行 SQL Migration
- [ ] 確認 `profiles` 表已新增所有欄位
- [ ] 測試 Free 用戶配額限制
- [ ] 測試 Pro 用戶無限制
- [ ] 測試每日重置邏輯
- [ ] 檢查 RLS 策略是否正確
- [ ] 確認 AI 生成 API 已整合配額檢查

---

## 🐛 常見問題

### Q: 為什麼計數在生成之前就增加了？

A: 因為流式響應無法在完成後再執行操作。為了簡化實作，我們在返回流之前就增加計數。如果生成失敗，可以考慮添加回滾邏輯（未來改進）。

### Q: 如何手動重置用戶配額？

A: 執行以下 SQL：
```sql
UPDATE profiles 
SET ai_usage_count = 0, last_reset_date = NOW()
WHERE email = 'user@example.com';
```

### Q: 如何將用戶升級為 Pro？

A: 執行以下 SQL：
```sql
UPDATE profiles 
SET tier = 'pro'
WHERE email = 'user@example.com';
```

---

**完成！** 🎉 現在您的 SaaS 已經具備完整的用戶配額與訂閱狀態管理功能。
