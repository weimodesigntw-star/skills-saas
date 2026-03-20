'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { useRouter } from 'next/navigation';

interface SyncProductsButtonProps {
  lastSyncedAt?: string | null;
  lastSyncedCount?: number | null;
}

export function SyncProductsButton({ lastSyncedAt, lastSyncedCount }: SyncProductsButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  const handleSync = async (mode: 'incremental' | 'full') => {
    setSyncing(true);
    try {
      const res = await fetch('/api/easystore/sync-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? '商品同步失敗');
      } else {
        toast.success(
          `${mode === 'full' ? '全量' : data.since ? '增量' : '首次增量（等同全量）'}同步完成：${data.synced} 筆` +
            `${data.failed > 0 ? `，${data.failed} 筆失敗` : ''}`
        );
        router.refresh();
      }
    } catch {
      toast.error('網路錯誤，請稍後再試');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => handleSync('incremental')} disabled={syncing}>
        <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? '同步中...' : '同步商品'}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => handleSync('full')} disabled={syncing}>
        全量
      </Button>
      {lastSyncedAt && (
        <span className="text-xs text-muted-foreground">
          上次同步：
          {new Date(lastSyncedAt).toLocaleString('zh-TW', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {lastSyncedCount != null ? `（${lastSyncedCount} 筆）` : ''}
        </span>
      )}
    </div>
  );
}
