import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const RATE_LIMIT = new Map<string, {count:number; reset:number}>()

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limit API routes
  if (pathname.startsWith('/api/gemini') || pathname.startsWith('/api/economic')) {
    const ip = request.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()
    const limit = RATE_LIMIT.get(ip)

    if (limit && now < limit.reset) {
      if (limit.count >= 10) { // 10 requests per minute
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      limit.count++
    } else {
      RATE_LIMIT.set(ip, { count: 1, reset: now + 60000 })
    }
  }

  // Auth protection for dashboard routes
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/journal') ||
      pathname.startsWith('/backtest') || pathname.startsWith('/ai-insights') ||
      pathname.startsWith('/reports') || pathname.startsWith('/prop-firms')) {

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: () => {}, remove: () => {}
      }}
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/journal/:path*', '/backtest/:path*',
    '/ai-insights/:path*', '/reports/:path*', '/prop-firms/:path*',
    '/api/gemini', '/api/economic-calendar']
}
