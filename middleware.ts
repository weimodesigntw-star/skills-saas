// middleware.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * 🔒 驗證 redirect 路徑是否安全（僅允許內部路徑）
 */
function isValidRedirect(redirect: string): boolean {
  // 必須以 / 開頭
  if (!redirect.startsWith('/')) return false;
  // 不允許 // 開頭（防止 protocol-relative URL，如 //evil.com）
  if (redirect.startsWith('//')) return false;
  // 不允許包含反斜線（某些瀏覽器會將 /\ 解析為 //）
  if (redirect.includes('\\')) return false;
  // 不允許包含 @ 符號（防止 /user@evil.com 這類攻擊）
  if (redirect.includes('@')) return false;
  // 不允許重定向到登入頁（防止循環）
  if (redirect.startsWith('/login')) return false;
  return true;
}

export async function middleware(request: NextRequest) {
  // 1. 初始化 Response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Middleware 需要同時更新 Request 和 Response 的 Cookies
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. 驗證用戶
  const { data: { session } } = await supabase.auth.getSession()

  let user = null

  if (session && session.user) {
    user = session.user
  } else {
    // 如果 getSession() 失敗，嘗試 getUser()
    const { data: { user: getUserResult } } = await supabase.auth.getUser()
    user = getUserResult || null
  }

  // 3. 路由守門員邏輯

  // A. 如果已登入，且在 /login -> 踢去 /dashboard/categories
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const redirect = request.nextUrl.searchParams.get('redirect') || '/dashboard/categories'

    // 🔒 安全修復：驗證 redirect 是否為安全的內部路徑
    if (isValidRedirect(redirect)) {
      const redirectUrl = new URL(redirect, request.url)
      return NextResponse.redirect(redirectUrl)
    }

    // 如果 redirect 不安全，使用預設路徑
    return NextResponse.redirect(new URL('/dashboard/categories', request.url))
  }

  // B. 如果未登入，且在 /dashboard -> 踢回 /login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * 匹配所有路徑，除了:
     * - _next/static (靜態文件)
     * - _next/image (圖片優化)
     * - favicon.ico (圖標)
     * - 圖片檔 (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
