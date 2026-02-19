'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Page error:', error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
        <h1 className="text-xl font-semibold mb-2">發生錯誤</h1>
        <p className="text-muted-foreground mb-6">
          {error.message || '頁面載入時發生問題，請稍後再試。'}
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={reset}>重試</Button>
          <Button variant="outline" asChild>
            <Link href="/">返回首頁</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
