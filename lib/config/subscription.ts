/**
 * 訂閱與配額配置
 * 
 * 統一管理所有訂閱相關的常量和配置
 */

/**
 * Free 用戶每日 AI 生成限制
 */
export const FREE_DAILY_LIMIT = 3;

/**
 * 訂閱層級類型
 */
export type SubscriptionTier = 'free' | 'pro';

/**
 * 訂閱層級配置
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: '免費方案',
    dailyLimit: FREE_DAILY_LIMIT,
    unlimited: false,
  },
  pro: {
    name: 'Pro 方案',
    dailyLimit: Infinity,
    unlimited: true,
  },
} as const;
