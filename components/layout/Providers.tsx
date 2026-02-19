'use client';

import { ToastProvider, useToast, setToastHandler } from '@/components/ui/toast';
import { useEffect } from 'react';

function ToastBridge({ children }: { children: React.ReactNode }) {
  const { addToast } = useToast();

  useEffect(() => {
    setToastHandler(addToast);
  }, [addToast]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ToastBridge>{children}</ToastBridge>
    </ToastProvider>
  );
}
