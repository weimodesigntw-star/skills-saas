/**
 * Login Page
 * 
 * 登入頁面
 */

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard/categories';
  
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

      console.log('登入成功，session:', data.session);
      console.log('準備重定向到:', redirect);

      // 確保 Supabase 客戶端已將 session 寫入 cookies
      // 多次檢查以確保 cookies 已正確設置
      let sessionReady = false;
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const { data: { session: checkSession }, error: sessionError } = await supabase.auth.getSession();
        
        if (checkSession && !sessionError) {
          // 檢查 cookies 是否已設置
          const cookies = document.cookie;
          if (cookies.includes('sb-') || i >= 2) {
            // 如果找到 Supabase cookie 或已重試多次，認為已準備好
            sessionReady = true;
            console.log(`Session 驗證成功 (嘗試 ${i + 1}/5)`);
            break;
          }
        }
        
        console.log(`等待 session 設置... (嘗試 ${i + 1}/5)`);
      }

      // 最終驗證
      const { data: { session: finalSession }, error: finalError } = await supabase.auth.getSession();
      
      if (!finalSession || finalError) {
        console.error('Session 設置失敗:', finalError);
        setError('Session 設置失敗，請重試');
        setLoading(false);
        return;
      }

      console.log('Session 驗證成功，準備跳轉到:', redirect);

      // 檢查 cookies 是否已設置
      const cookies = document.cookie;
      const hasSupabaseCookie = cookies.includes('sb-');
      console.log('當前 Cookies:', cookies);
      console.log('是否有 Supabase Cookie:', hasSupabaseCookie);

      // 等待額外時間確保 cookies 已完全設置並同步到瀏覽器
      // 增加等待時間，確保 cookies 完全寫入
      await new Promise(resolve => setTimeout(resolve, 500));

      // 再次檢查 cookies
      const finalCookies = document.cookie;
      console.log('最終 Cookies:', finalCookies);
      const finalHasSupabaseCookie = finalCookies.includes('sb-');
      console.log('最終是否有 Supabase Cookie:', finalHasSupabaseCookie);

      // 構建完整的重定向 URL
      const redirectUrl = redirect.startsWith('/') 
        ? `${window.location.origin}${redirect}`
        : redirect;
      
      console.log('執行重定向到:', redirectUrl);
      console.log('--- 登入流程完成，開始跳轉 ---');
      
      // 直接跳轉到目標頁面
      // 使用 window.location.href 進行完整頁面跳轉，確保 cookies 會被發送到 middleware
      window.location.href = redirectUrl;
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
