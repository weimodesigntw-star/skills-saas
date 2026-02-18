'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LogoutButton } from '@/components/auth/LogoutButton';
import {
  LayoutDashboard,
  FolderTree,
  FileText,
  ShoppingCart,
  ClipboardList,
  Receipt,
  Package,
  BarChart3,
  Settings,
  Menu,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';

// ===========================
// Navigation Config
// ===========================

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group: 'main' | 'pos' | 'system';
  badge?: string;
}

const navItems: NavItem[] = [
  // — 主要功能 —
  { label: '總覽', href: '/dashboard', icon: LayoutDashboard, group: 'main' },
  { label: '分類管理', href: '/dashboard/categories', icon: FolderTree, group: 'main' },
  { label: '規格管理', href: '/dashboard/specifications', icon: FileText, group: 'main' },
  { label: '商品管理', href: '/dashboard/products', icon: Package, group: 'main' },
  // — POS —
  { label: 'POS 銷售', href: '/dashboard/pos', icon: ShoppingCart, group: 'pos', badge: 'New' },
  { label: '訂單管理', href: '/dashboard/pos/orders', icon: ClipboardList, group: 'pos' },
  { label: '電子發票', href: '/dashboard/pos/invoices', icon: Receipt, group: 'pos' },
  { label: '庫存管理', href: '/dashboard/pos/inventory', icon: Package, group: 'pos' },
  // — 系統 —
  { label: '報表分析', href: '/dashboard/reports', icon: BarChart3, group: 'system' },
  { label: '設定', href: '/dashboard/pos/settings', icon: Settings, group: 'system' },
];

const groupLabels: Record<string, string> = {
  main: '主要功能',
  pos: 'POS 銷售系統',
  system: '系統',
};

// ===========================
// NavLink Component
// ===========================

function NavLink({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        isActive
          ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
          : 'text-muted-foreground',
        collapsed && 'justify-center px-2'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', collapsed ? 'h-5 w-5' : '')} />
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                item.badge === 'New'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {item.label}
          {item.badge && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
              {item.badge}
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// ===========================
// Desktop Sidebar
// ===========================

function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();

  const groups = ['main', 'pos', 'system'] as const;

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      {/* Logo / Header */}
      <div className={cn('flex items-center border-b h-14 px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">Skills</span>
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-8 w-8">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <TooltipProvider>
          {groups.map((group, groupIdx) => {
            const items = navItems.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group} className={cn(groupIdx > 0 && 'mt-4')}>
                {!collapsed && (
                  <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {groupLabels[group]}
                  </p>
                )}
                {collapsed && groupIdx > 0 && <Separator className="my-2" />}
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={
                        item.href === '/dashboard'
                          ? pathname === '/dashboard'
                          : pathname.startsWith(item.href)
                      }
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </TooltipProvider>
      </nav>

      {/* Footer */}
      <div className={cn('border-t p-3', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <TooltipProvider>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div>
                  <LogoutButton />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">登出</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <LogoutButton />
        )}
      </div>
    </aside>
  );
}

// ===========================
// Mobile Sidebar (Sheet)
// ===========================

function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const pathname = usePathname();
  const groups = ['main', 'pos', 'system'] as const;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Skills SaaS
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group, groupIdx) => {
            const items = navItems.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group} className={cn(groupIdx > 0 && 'mt-4')}>
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {groupLabels[group]}
                </p>
                <div className="space-y-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      isActive={
                        item.href === '/dashboard'
                          ? pathname === '/dashboard'
                          : pathname.startsWith(item.href)
                      }
                      collapsed={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t p-3">
          <LogoutButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ===========================
// Exported Sidebar
// ===========================

export function AppSidebar({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <DesktopSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      {/* Mobile sidebar */}
      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex md:hidden items-center border-b h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href="/dashboard" className="ml-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-bold">Skills</span>
          </Link>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
