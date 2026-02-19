'use client';

import { useEffect } from 'react';

/**
 * 根層級錯誤邊界
 * 用於捕獲 layout 或 Providers 內發生的錯誤
 * 必須包含完整的 html/body 結構，因為會取代整個 layout
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <html lang="zh-TW">
      <body className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            系統發生錯誤
          </h1>
          <p className="text-slate-600 mb-6">
            {error.message || '應用程式載入失敗，請重新整理頁面。'}
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            重新整理
          </button>
        </div>
      </body>
    </html>
  );
}
