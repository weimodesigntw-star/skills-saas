# 用戶配額功能 - 手動檢測指南

## 📋 檢測步驟總覽

1. ✅ **驗證資料庫結構**
2. ✅ **檢查現有用戶資料**
3. ✅ **測試配額檢查邏輯**
4. ✅ **測試配額限制**
5. ✅ **測試每日重置**
6. ✅ **測試 Pro 用戶無限制**

---

## 步驟 1：驗證資料庫結構

### 1.1 檢查所有欄位是否存在

在 **Supabase SQL Editor** 執行：

```sql
-- 檢查 profiles 表的所有欄位
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

**預期結果**：應該看到以下新欄位：
- `tier` (TEXT, default: 'free')
- `ai_usage_count` (INTEGER, default: 0)
- `last_reset_date` (TIMESTAMPTZ)
- `stripe_customer_id` (TEXT, nullable)
- `stripe_subscription_id` (TEXT, nullable)

### 1.2 檢查 RLS 策略

```sql
-- 檢查 RLS 策略
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'profiles';
```

**預期結果**：應該看到兩個策略：
- `Users can view own profile` (SELECT)
- `Users can update own profile` (UPDATE)

### 1.3 檢查觸發器

```sql
-- 檢查觸發器
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'profiles';
```

**預期結果**：應該看到 `update_profiles_updated_at` 觸發器

---

## 步驟 2：檢查現有用戶資料

### 2.1 查看所有用戶的配額狀態

```sql
-- 查看所有用戶的配額狀態
SELECT 
  id,
  email,
  tier,
  ai_usage_count,
  last_reset_date,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;
```

**預期結果**：
- 所有用戶的 `tier` 應該是 `'free'`
- `ai_usage_count` 應該是 `0` 或更大的數字
- `last_reset_date` 應該是最近的日期

### 2.2 檢查特定用戶的配額

```sql
-- 替換 'your-email@example.com' 為你的實際郵箱
SELECT 
  email,
  tier,
  ai_usage_count,
  last_reset_date,
  CASE 
    WHEN tier = 'pro' THEN '無限制'
    WHEN ai_usage_count < 3 THEN CONCAT('剩餘 ', 3 - ai_usage_count, ' 次')
    ELSE '已達限制'
  END AS quota_status
FROM profiles
WHERE email = 'your-email@example.com';
```

---

## 步驟 3：測試配額檢查邏輯（手動 SQL 模擬）

### 3.1 測試 Free 用戶未達限制

```sql
-- 設置用戶為 Free，使用次數為 0
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 0,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- 檢查配額狀態（應該允許）
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN tier = 'pro' THEN true
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed,
  3 - ai_usage_count AS remaining
FROM profiles
WHERE email = 'your-email@example.com';
```

**預期結果**：`allowed = true`, `remaining = 3`

### 3.2 測試 Free 用戶達到限制

```sql
-- 設置用戶為 Free，使用次數為 3（已達限制）
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 3,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- 檢查配額狀態（應該拒絕）
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN tier = 'pro' THEN true
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed,
  3 - ai_usage_count AS remaining
FROM profiles
WHERE email = 'your-email@example.com';
```

**預期結果**：`allowed = false`, `remaining = 0`

---

## 步驟 4：測試每日重置邏輯

### 4.1 模擬重置邏輯

```sql
-- 設置 last_reset_date 為昨天，使用次數為 3
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 3,
  last_reset_date = NOW() - INTERVAL '1 day'
WHERE email = 'your-email@example.com';

-- 檢查是否需要重置（模擬 checkAiLimit 的邏輯）
SELECT 
  email,
  ai_usage_count AS current_count,
  last_reset_date,
  CASE 
    WHEN DATE(last_reset_date) < CURRENT_DATE THEN true
    ELSE false
  END AS should_reset,
  CASE 
    WHEN DATE(last_reset_date) < CURRENT_DATE THEN 0
    ELSE ai_usage_count
  END AS new_count_after_reset
FROM profiles
WHERE email = 'your-email@example.com';
```

**預期結果**：`should_reset = true`, `new_count_after_reset = 0`

### 4.2 手動執行重置

```sql
-- 手動重置（模擬 checkAiLimit 的行為）
UPDATE profiles 
SET 
  ai_usage_count = 0,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com'
  AND DATE(last_reset_date) < CURRENT_DATE;

-- 驗證重置結果
SELECT 
  email,
  ai_usage_count,
  last_reset_date
FROM profiles
WHERE email = 'your-email@example.com';
```

**預期結果**：`ai_usage_count = 0`, `last_reset_date` 更新為今天

---

## 步驟 5：測試 Pro 用戶無限制

### 5.1 設置用戶為 Pro

```sql
-- 將用戶升級為 Pro
UPDATE profiles 
SET 
  tier = 'pro',
  ai_usage_count = 0
WHERE email = 'your-email@example.com';

-- 檢查配額狀態（應該無限制）
SELECT 
  email,
  tier,
  ai_usage_count,
  CASE 
    WHEN tier = 'pro' THEN true
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed
FROM profiles
WHERE email = 'your-email@example.com';
```

**預期結果**：`allowed = true`（無論 `ai_usage_count` 是多少）

---

## 步驟 6：實際應用測試

### 6.1 測試正常生成（未達限制）

1. **準備**：確保用戶 `ai_usage_count < 3`
   ```sql
   UPDATE profiles 
   SET ai_usage_count = 0
   WHERE email = 'your-email@example.com';
   ```

2. **操作**：
   - 登入應用
   - 進入分類管理頁面
   - 嘗試生成 AI 分類

3. **檢查**：
   - ✅ 應該成功生成
   - ✅ 終端日誌顯示：`[Check AI Limit] ... allowed: true`
   - ✅ 終端日誌顯示：`[Increment AI Usage] Success`
   - ✅ 資料庫中 `ai_usage_count` 應該 +1

4. **驗證資料庫**：
   ```sql
   SELECT email, ai_usage_count 
   FROM profiles 
   WHERE email = 'your-email@example.com';
   ```

### 6.2 測試配額限制（已達限制）

1. **準備**：設置用戶已達限制
   ```sql
   UPDATE profiles 
   SET ai_usage_count = 3
   WHERE email = 'your-email@example.com';
   ```

2. **操作**：
   - 登入應用
   - 嘗試生成 AI 分類

3. **檢查**：
   - ❌ 應該返回錯誤："您已達到今日免費額度"
   - ✅ 終端日誌顯示：`[AI Generate] Quota limit reached`
   - ✅ API 返回 403 狀態碼
   - ✅ 資料庫中 `ai_usage_count` 仍然是 3（沒有增加）

4. **檢查瀏覽器 Network**：
   - 打開開發者工具 → Network
   - 找到 `/api/ai/generate` 請求
   - 檢查 Response：
     ```json
     {
       "error": "您已達到今日免費額度",
       "message": "免費方案每日限制 3 次 AI 生成...",
       "quota": {
         "remaining": 0,
         "limit": 3,
         "tier": "free"
       }
     }
     ```

### 6.3 測試每日重置

1. **準備**：設置用戶為昨天重置，已達限制
   ```sql
   UPDATE profiles 
   SET 
     ai_usage_count = 3,
     last_reset_date = NOW() - INTERVAL '1 day'
   WHERE email = 'your-email@example.com';
   ```

2. **操作**：
   - 登入應用
   - 嘗試生成 AI 分類

3. **檢查**：
   - ✅ 應該成功生成（因為自動重置）
   - ✅ 終端日誌顯示：`[Check AI Limit] Reset usage count for user: ...`
   - ✅ 資料庫中 `ai_usage_count` 應該是 1（重置後 +1）
   - ✅ `last_reset_date` 更新為今天

4. **驗證資料庫**：
   ```sql
   SELECT 
     email, 
     ai_usage_count, 
     last_reset_date,
     DATE(last_reset_date) = CURRENT_DATE AS is_today
   FROM profiles 
   WHERE email = 'your-email@example.com';
   ```

---

## 步驟 7：檢查終端日誌

### 7.1 正常生成時的日誌

應該看到以下日誌順序：

```
[AI Generate] Received request with topic: ...
[Check AI Limit] { userId: '...', tier: 'free', currentUsage: 0, limit: 3, remaining: 3, allowed: true }
[AI Generate] Quota check passed { remaining: 3, limit: 3, tier: 'free' }
[AI Generate] Using Google AI model: gemini-2.5-flash
[AI Generate] Stream started successfully
[Increment AI Usage] Success { userId: '...', tier: 'free', oldCount: 0, newCount: 1 }
```

### 7.2 達到限制時的日誌

應該看到：

```
[AI Generate] Received request with topic: ...
[Check AI Limit] { userId: '...', tier: 'free', currentUsage: 3, limit: 3, remaining: 0, allowed: false }
[AI Generate] Quota limit reached { allowed: false, remaining: 0, limit: 3, tier: 'free' }
```

---

## 步驟 8：完整測試流程

### 測試腳本（按順序執行）

```sql
-- ============================================
-- 完整測試流程
-- ============================================

-- 1. 重置測試用戶
UPDATE profiles 
SET 
  tier = 'free',
  ai_usage_count = 0,
  last_reset_date = NOW()
WHERE email = 'your-email@example.com';

-- 2. 檢查初始狀態
SELECT 
  email,
  tier,
  ai_usage_count,
  last_reset_date,
  CASE 
    WHEN tier = 'pro' THEN '無限制'
    WHEN ai_usage_count < 3 THEN CONCAT('剩餘 ', 3 - ai_usage_count, ' 次')
    ELSE '已達限制'
  END AS status
FROM profiles
WHERE email = 'your-email@example.com';

-- 3. 模擬使用 3 次（手動增加）
UPDATE profiles 
SET ai_usage_count = 3
WHERE email = 'your-email@example.com';

-- 4. 檢查達到限制後的狀態
SELECT 
  email,
  ai_usage_count,
  CASE 
    WHEN ai_usage_count < 3 THEN true
    ELSE false
  END AS allowed
FROM profiles
WHERE email = 'your-email@example.com';

-- 5. 測試重置邏輯（設置為昨天）
UPDATE profiles 
SET 
  ai_usage_count = 3,
  last_reset_date = NOW() - INTERVAL '1 day'
WHERE email = 'your-email@example.com';

-- 6. 檢查重置後的狀態（應該自動重置）
SELECT 
  email,
  ai_usage_count,
  last_reset_date,
  DATE(last_reset_date) = CURRENT_DATE AS is_today
FROM profiles
WHERE email = 'your-email@example.com';
```

---

## 🐛 常見問題排查

### 問題 1：配額檢查總是返回 false

**檢查**：
```sql
-- 檢查用戶是否有 profile 記錄
SELECT * FROM profiles WHERE email = 'your-email@example.com';

-- 如果沒有，檢查 auth.users
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

**解決**：如果 profile 不存在，`checkAiLimit()` 會自動創建，但需要確保 RLS 策略允許插入。

### 問題 2：重置邏輯不工作

**檢查**：
```sql
-- 檢查時區設置
SELECT 
  NOW() AS server_time,
  CURRENT_DATE AS server_date,
  last_reset_date,
  DATE(last_reset_date) AS reset_date_only,
  DATE(last_reset_date) < CURRENT_DATE AS should_reset
FROM profiles
WHERE email = 'your-email@example.com';
```

### 問題 3：Pro 用戶仍然被限制

**檢查**：
```sql
-- 確認 tier 欄位值
SELECT email, tier, ai_usage_count
FROM profiles
WHERE email = 'your-email@example.com';

-- 確保 tier 是 'pro'（小寫）
UPDATE profiles 
SET tier = 'pro'
WHERE email = 'your-email@example.com';
```

---

## ✅ 檢測完成檢查清單

- [ ] 資料庫結構正確（所有欄位存在）
- [ ] RLS 策略已啟用
- [ ] 觸發器已創建
- [ ] Free 用戶未達限制時可以生成
- [ ] Free 用戶達到限制時返回 403
- [ ] 每日重置邏輯正常工作
- [ ] Pro 用戶無限制使用
- [ ] 終端日誌顯示正確的配額檢查訊息
- [ ] 資料庫計數正確更新

---

**完成檢測後，所有功能應該正常運作！** 🎉
