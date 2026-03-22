'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FolderTree,
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  Newspaper,
  ImageIcon,
  Video,
  Users,
  ChevronLeft,
  ChevronRight,
  Hash,
  Warehouse,
  Building2,
  ClipboardList,
  Receipt,
  CreditCard,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const navGroups = [
  {
    label: '銷售',
    items: [
      { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
      { href: '/dashboard/pos', label: 'POS 銷售', icon: ShoppingCart },
      { href: '/dashboard/orders', label: '客戶訂單', icon: ClipboardList },
    ],
  },
  {
    label: '庫存',
    items: [
      { href: '/dashboard/products', label: '商品', icon: Package },
      { href: '/dashboard/inventory', label: '庫存管理', icon: Warehouse },
      { href: '/dashboard/purchases', label: '採購管理', icon: ShoppingCart },
      { href: '/dashboard/vendors', label: '廠商管理', icon: Building2 },
    ],
  },
  {
    label: '財務',
    items: [
      { href: '/dashboard/receivables', label: '應收沖帳', icon: Receipt },
      { href: '/dashboard/payables', label: '應付沖帳', icon: CreditCard },
      { href: '/dashboard/reports', label: '報表', icon: BarChart3 },
    ],
  },
  {
    label: '客戶',
    items: [{ href: '/dashboard/members', label: '會員管理', icon: Users }],
  },
  {
    label: '內容',
    items: [
      { href: '/dashboard/news', label: '最新消息', icon: Newspaper },
      { href: '/dashboard/videos', label: '影片管理', icon: Video },
      { href: '/dashboard/galleries', label: '照片集', icon: ImageIcon },
    ],
  },
  {
    label: '設定',
    items: [
      { href: '/dashboard/categories', label: '分類管理', icon: FolderTree },
      { href: '/dashboard/product-tags', label: '標籤管理', icon: Tag },
      { href: '/dashboard/pos/sequences', label: '字軌設定', icon: Hash },
      { href: '/dashboard/specifications', label: '規格', icon: FileText },
    ],
  },
];

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'border-r bg-card flex flex-col transition-[width] duration-200',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed && (
            <Link href="/dashboard" className="font-semibold text-foreground">
              Skills
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? '展開' : '收合'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-2">
              {!collapsed && (
                <div className="text-xs text-muted-foreground uppercase tracking-wider px-3 pt-4 pb-1">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    pathname === href ||
                    (href !== '/dashboard' && href !== '/dashboard/pos' && pathname.startsWith(href));
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
