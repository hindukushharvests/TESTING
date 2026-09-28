import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  // 1. Verify the requester is logged in + is an admin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Not admin' }, { status: 403 })

  // 2. Use service role to read all profiles + auth emails
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const { data: profiles } = await admin.from('profiles').select('*')

  const merged = (profiles || []).map(p => {
    const au = authData?.users.find(u => u.id === p.id)
    return {
      id: p.id,
      email: au?.email || 'unknown',
      created_at: au?.created_at || p.created_at,
      subscription_tier: p.subscription_tier || 'free',
      subscription_status: p.subscription_status || 'active',
      subscription_ends_at: p.subscription_ends_at,
      is_admin: p.is_admin || false,
    }
  })

  // Sort: admins first, then by tier
  merged.sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1
    return 0
  })

  return NextResponse.json({ users: merged })
}

// Update a user's tier (admin only)
export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Not admin' }, { status: 403 })

  const { userId, tier, days } = await req.json()
  const endsAt = days ? new Date(Date.now() + days * 86400000).toISOString() : (tier === 'free' ? null : '2099-12-31')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { error } = await admin.from('profiles').update({
    subscription_tier: tier,
    subscription_ends_at: endsAt,
    subscription_status: 'active',
  }).eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
