import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { authLimiter, checkRateLimit } from '@/lib/ratelimit'

const PROTECTED_ROUTES = ['/dashboard', '/search', '/saved', '/history', '/exports', '/settings', '/admin']
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password']
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Rate limit auth endpoints per IP
  if (request.nextUrl.pathname === '/api/auth/send-reset-email') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const { success, retryAfter } = await checkRateLimit(authLimiter, ip)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
  }

  // Skip auth enforcement when Supabase isn't configured yet
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl === PLACEHOLDER_URL) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAuthRoute = AUTH_ROUTES.some(r => pathname.startsWith(r))

  // Deactivated user check — kick them out before they reach any protected page
  if (isProtected && user && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const adminDb = createSupabaseClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
    const { data: userProfile } = await adminDb
      .from('users_profile')
      .select('status')
      .eq('id', user.id)
      .maybeSingle()

    if (userProfile?.status === 'deactivated') {
      await adminDb.auth.admin.signOut(user.id, 'global')
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('deactivated', 'true')
      return NextResponse.redirect(url)
    }
  }

  // Unauthenticated user trying to access protected route
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated user trying to access auth routes → send to dashboard
  if (isAuthRoute && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|og|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
