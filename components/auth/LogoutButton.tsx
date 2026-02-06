/**
 * Logout Button Component
 * 
 * 登出按鈕組件
 */

'use client';

import { useState } from 'react';
import { signOut } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
    } catch (error) {
      console.error('登出失敗:', error);
      setLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleLogout}
      disabled={loading}
      className="w-full justify-start"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {loading ? '登出中...' : '登出'}
    </Button>
  );
}
