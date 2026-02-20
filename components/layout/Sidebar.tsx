'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AppSidebar({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen"><aside className="w-56 border-r bg-card p-4">Sidebar</aside><main className="flex-1">{children}</main></div>;
}
