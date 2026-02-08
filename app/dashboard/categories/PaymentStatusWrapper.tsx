/**
 * Payment Status Wrapper
 * 
 * Client Component wrapper for PaymentStatus (needs useSearchParams)
 */

'use client';

import { Suspense } from 'react';
import { PaymentStatus } from '@/components/stripe/PaymentStatus';

export function PaymentStatusWrapper() {
  return (
    <Suspense fallback={null}>
      <PaymentStatus />
    </Suspense>
  );
}
