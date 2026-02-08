/**
 * Upgrade to Pro Button Component
 * 
 * 升級到 Pro 方案的按鈕組件
 * - 如果用戶是 Pro：顯示「管理訂閱」按鈕，點擊後進入 Stripe Customer Portal
 * - 如果用戶是 Free：顯示「升級至 Pro」按鈕，點擊後進入 Stripe Checkout
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createCheckoutSession, createCustomerPortalSession } from '@/app/actions/stripe';
import { Loader2, Sparkles, Settings } from 'lucide-react';

interface UpgradeButtonProps {
  isPro?: boolean; // 新增這個屬性
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  children?: React.ReactNode;
}

export function UpgradeButton({ 
  isPro = false,
  variant = 'default', 
  size = 'default',
  className,
  children 
}: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 核心邏輯：如果是 Pro -> 去管理頁面；否則 -> 去結帳
      const action = isPro ? createCustomerPortalSession : createCheckoutSession;
      const result = await action();

      if ('error' in result) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      // 重定向到 Stripe Checkout 或 Customer Portal
      if (result.url) {
        window.location.href = result.url;
      } else {
        setError('無法取得連結');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Action error:', err);
      setError(err instanceof Error ? err.message : '操作失敗，請稍後再試');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleAction}
        disabled={isLoading}
        variant={variant}
        size={size}
        className={className}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            處理中...
          </>
        ) : (
          <>
            {children || (
              isPro ? (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  管理訂閱
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  升級至 Pro
                </>
              )
            )}
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
