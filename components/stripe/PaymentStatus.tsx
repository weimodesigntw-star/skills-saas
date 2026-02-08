/**
 * Payment Status Component
 * 
 * 顯示支付成功或取消的狀態
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function PaymentStatus() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (success || canceled) {
      setIsVisible(true);
      
      // 5 秒後自動隱藏
      const timer = setTimeout(() => {
        setIsVisible(false);
        // 清除 URL 參數
        router.replace('/dashboard/categories');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [success, canceled, router]);

  if (!isVisible || (!success && !canceled)) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
      <Card className={`min-w-[300px] shadow-lg ${
        success 
          ? 'border-green-500 bg-green-50' 
          : 'border-red-500 bg-red-50'
      }`}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            {success ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900 mb-1">
                    升級成功！
                  </h4>
                  <p className="text-sm text-green-700">
                    您已成功升級至 Pro 方案，現在可以享受無限 AI 生成功能。
                  </p>
                  {sessionId && (
                    <p className="text-xs text-green-600 mt-2">
                      Session ID: {sessionId.substring(0, 20)}...
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-red-900 mb-1">
                    支付已取消
                  </h4>
                  <p className="text-sm text-red-700">
                    支付流程已取消。您可以隨時再次嘗試升級。
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
