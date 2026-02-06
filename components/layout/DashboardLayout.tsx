/**
 * Dashboard Layout Component
 * 
 * Dashboard 頁面的共用佈局，包含導航欄和登出按鈕
 */

import { LogoutButton } from '@/components/auth/LogoutButton';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* 頂部導航欄 */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">分類管理系統</h1>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* 主要內容 */}
      <main>{children}</main>
    </div>
  );
}
