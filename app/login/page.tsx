/**
 * Login Page
 *
 * 登入頁面
 */

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * 🔒 驗證 redirect 路徑是否安全（僅允許內部路徑）
 */
function isValidRedirect(redirect: string): boolean {
  if (!redirect.startsWith('/')) return false;
  if (redirect.startsWith('//')) return false;
  if (redirect.includes('\\')) return false;
  if (redirect.includes('@')) return false;
  if (redirect.startsWith('/login')) return false;
  return true;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/dashboard/categories';
  const redirect = isValidRedirect(rawRedirect) ? rawRedirect : '/dashboard/categories';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError('登入失敗，無法建立會話');
        setLoading(false);
        return;
      }

      // 等待 session cookies 設定完成
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));

        const { data: { session: checkSession }, error: sessionError } = await supabase.auth.getSession();

        if (checkSession && !sessionError) {
          const cookies = document.cookie;
          if (cookies.includes('sb-') || i >= 2) {
            break;
          }
        }
      }

      // 最終驗證
      const { data: { session: finalSession }, error: finalError } = await supabase.auth.getSession();

      if (!finalSession || finalError) {
        setError('Session 設置失敗，請重試');
        setLoading(false);
        return;
      }

      // 等待 cookies 完全寫入
      await new Promise(resolve => setTimeout(resolve, 500));

      // 使用完整頁面跳轉，確保 cookies 會被發送到 middleware
      window.location.href = `${window.location.origin}${redirect}`;
    } catch (err) {
      console.error('登入錯誤:', err);
      setError('登入失敗，請稍後再試');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">登入</CardTitle>
          <CardDescription>
            輸入您的帳號和密碼以繼續
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">電子郵件</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full"
              disabled={loading}
            >
              {loading ? '登入中...' : '登入'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">登入</CardTitle>
            <CardDescription>載入中...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
