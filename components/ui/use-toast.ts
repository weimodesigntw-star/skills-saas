/**
 * useToast Hook
 *
 * A simple hook interface for showing toast notifications
 */

'use client';

import { toast } from './toast';

interface ToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

export function useToast() {
  return {
    toast: (options: ToastOptions) => {
      const message = options.description || options.title || '';

      if (options.variant === 'destructive') {
        toast.error(message);
      } else {
        toast.info(message);
      }
    },
  };
}
