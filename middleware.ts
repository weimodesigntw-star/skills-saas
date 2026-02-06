// middleware.ts
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  // 1. 初始化 Response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // ⚠️ DEBUG: 檢查收到的 Cookies
  const allCookies = request.cookies.getAll()
  const supabaseCookies = allCookies.filter(cookie => cookie.name.includes('sb-'))
  console.log(`[Middleware] Path: ${request.nextUrl.pathname}`)
  console.log(`[Middleware] Total Cookies: ${allCookies.length}`)
  console.log(`[Middleware] Supabase Cookies: ${supabaseCookies.length}`)
  if (supabaseCookies.length > 0) {
    console.log(`[Middleware] Supabase Cookie Names: ${supabaseCookies.map(c => c.name).join(', ')}`)
    // 檢查 Cookie 值的前幾個字元（不顯示完整值以保護隱私）
    supabaseCookies.forEach(cookie => {
      const valuePreview = cookie.value ? cookie.value.substring(0, 50) + '...' : '(empty)'
      console.log(`[Middleware] Cookie ${cookie.name} value preview: ${valuePreview}`)
      console.log(`[Middleware] Cookie ${cookie.name} value length: ${cookie.value?.length || 0}`)
    })
  }
  
  // 檢查環境變數
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  console.log(`[Middleware] Env URL: ${envUrl ? envUrl.substring(0, 30) + '...' : 'NOT SET'}`)
  console.log(`[Middleware] Env Key: ${envKey ? envKey.substring(0, 20) + '...' : 'NOT SET'}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 這是關鍵：Middleware 需要同時更新 Request 和 Response 的 Cookies
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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
  // 先嘗試 getSession()，如果失敗再嘗試 getUser()
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  let user = null
  let authError = sessionError
  
  if (session && session.user) {
    user = session.user
    console.log(`[Middleware] Session found via getSession()`)
  } else {
    // 如果 getSession() 失敗，嘗試 getUser()
    const { data: { user: getUserResult }, error: getUserError } = await supabase.auth.getUser()
    user = getUserResult || null
    authError = getUserError || sessionError
    if (getUserResult) {
      console.log(`[Middleware] User found via getUser()`)
    }
  }

  // ⚠️ DEBUG LOG: 讓我們看看伺服器看到了什麼
  console.log(`[Middleware] Has Session? ${!!session}`)
  console.log(`[Middleware] Has User? ${!!user}`)
  if (user) {
    console.log(`[Middleware] User ID: ${user.id}`)
  }
  if (authError) {
    console.log(`[Middleware] Auth Error: ${authError.message}`)
  }
  if (sessionError && !authError) {
    console.log(`[Middleware] Session Error: ${sessionError.message}`)
  }

  // 3. 路由守門員邏輯

  // A. 如果已登入，且在 /login -> 踢去 /dashboard/categories
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const redirect = request.nextUrl.searchParams.get('redirect') || '/dashboard/categories'
    const redirectUrl = new URL(redirect, request.url)
    
    // 防止重定向循環：確保重定向目標不是登入頁
    if (!redirectUrl.pathname.startsWith('/login')) {
      console.log(`[Middleware] User logged in, redirecting to ${redirectUrl.pathname}`)
      return NextResponse.redirect(redirectUrl)
    }
  }

  // B. 如果未登入，且在 /dashboard -> 踢回 /login
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    console.log(`[Middleware] No user found, redirecting to login`)
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