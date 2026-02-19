/**
 * POS 全螢幕 Layout
 *
 * POS 模組需要全螢幕空間，隱藏側邊欄
 * 提供頂部工具列：返回、標題、設定
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PosLayoutProps {
  children: ReactNode;
}

export default function PosLayout({ children }: PosLayoutProps) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              title="返回 Dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">POS 銷售</h1>
        </div>

        <Link href="/dashboard/pos/settings">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="POS 設定"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
