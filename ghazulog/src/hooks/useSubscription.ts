'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function getWeekStart(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1  // Monday start
  d.setDate(d.getDate() - diff)
  return d.toISOString().split('T')[0]
}

export type Tier = 'free' | 'pro' | 'elite'

export interface PlanLimits {
  tradesPerDay: number
  aiPerWeek: number
  totalTrades: number
  canBacktest: boolean
  canAI: boolean
  canPropFirm: boolean
  canPlaybooks: boolean
  canExportCSV: boolean
  canImportCSV: boolean
  canAPIAccess: boolean
  maxImportsPerDay: number
  maxBacktestSessions: number
}

export const PLAN_LIMITS: Record<Tier, PlanLimits> = {
  free: {
    tradesPerDay: 10,
    aiPerWeek: 999999,
    totalTrades: 999999,
    canBacktest: true,
    canAI: true,
    canPropFirm: false,
    canPlaybooks: false,
    canExportCSV: false,
    canImportCSV: true,  // allow but limited
    canAPIAccess: false,
    maxImportsPerDay: 1,
    maxBacktestSessions: 0,
  },
  pro: {
    tradesPerDay: 999999,
    aiPerWeek: 10,
    totalTrades: 999999,
    canBacktest: true,
    canAI: true,
    canPropFirm: false,
    canPlaybooks: true,
    canExportCSV: true,
    canImportCSV: true,
    canAPIAccess: false,
    maxImportsPerDay: 10,
    maxBacktestSessions: 20,
  },
  elite: {
    tradesPerDay: 999999,
    aiPerWeek: 999999,
    totalTrades: 999999,
    canBacktest: true,
    canAI: true,
    canPropFirm: true,
    canPlaybooks: true,
    canExportCSV: true,
    canImportCSV: true,
    canAPIAccess: true,
    maxImportsPerDay: 999,
    maxBacktestSessions: 999,
  },
}

export function useSubscription() {
  const supabase = createClient()
  const [tier, setTier] = useState<Tier>('free')
  const [loading, setLoading] = useState(true)
  const [todayTrades, setTodayTrades] = useState(0)
  const [todayAI, setTodayAI] = useState(0)
  const [aiThisWeek, setAiThisWeek] = useState(0)
  const [todayImports, setTodayImports] = useState(0)
  const [userId, setUserId] = useState<string|null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, subscription_ends_at')
        .eq('id', user.id)
        .single()

      if (profile) {
        let activeTier = (profile.subscription_tier || 'free') as Tier
        if (profile.subscription_ends_at && new Date(profile.subscription_ends_at) < new Date()) {
          activeTier = 'free'
          await supabase.from('profiles').update({ subscription_tier: 'free' }).eq('id', user.id)
        }
        setTier(activeTier)
      }

      // Get today's usage
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('trades_logged, ai_requests, imports_today')
        .eq('user_id', user.id)
        .eq('date', today)
        .single()

      if (usage) {
        setTodayTrades(usage.trades_logged || 0)
        setTodayAI(usage.ai_requests || 0)
        setTodayImports(usage.imports_today || 0)
      }

      // Weekly AI usage (week starts Monday)
      const ws = getWeekStart()
      const { data: weekly } = await supabase
        .from('ai_usage_weekly')
        .select('count')
        .eq('user_id', user.id)
        .eq('week_start', ws)
        .single()
      if (weekly) setAiThisWeek(weekly.count || 0)
      setLoading(false)
    }
    load()
  }, [])

  const limits = PLAN_LIMITS[tier]

  async function incrementTrades() {
    if (!userId) return false
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('trades_logged')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    
    const newCount = (existing?.trades_logged || 0) + 1
    await supabase.from('usage_tracking').upsert({
      user_id: userId,
      date: today,
      trades_logged: newCount,
    }, { onConflict: 'user_id,date' })
    setTodayTrades(newCount)
    return true
  }

  async function incrementAIWeekly() {
    if (!userId) return false
    const ws = getWeekStart()
    const { data: existing } = await supabase
      .from('ai_usage_weekly')
      .select('count')
      .eq('user_id', userId)
      .eq('week_start', ws)
      .single()
    const newCount = (existing?.count || 0) + 1
    await supabase.from('ai_usage_weekly').upsert({
      user_id: userId, week_start: ws, count: newCount,
    }, { onConflict: 'user_id,week_start' })
    setAiThisWeek(newCount)
    return true
  }

  async function incrementAI() {
    if (!userId) return false
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('ai_requests')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    
    const newCount = (existing?.ai_requests || 0) + 1
    await supabase.from('usage_tracking').upsert({
      user_id: userId,
      date: today,
      ai_requests: newCount,
    }, { onConflict: 'user_id,date' })
    setTodayAI(newCount)
    return true
  }

  async function incrementImports() {
    if (!userId) return false
    const today = new Date().toISOString().split('T')[0]
    const { data: existing } = await supabase
      .from('usage_tracking')
      .select('imports_today')
      .eq('user_id', userId)
      .eq('date', today)
      .single()
    
    const newCount = (existing?.imports_today || 0) + 1
    await supabase.from('usage_tracking').upsert({
      user_id: userId,
      date: today,
      imports_today: newCount,
    }, { onConflict: 'user_id,date' })
    setTodayImports(newCount)
    return true
  }

  return {
    tier,
    loading,
    userId,
    limits,
    todayTrades,
    todayAI,
    todayImports,

    isFree: tier === 'free',
    isPro: tier === 'pro' || tier === 'elite',
    isElite: tier === 'elite',

    tradesRemaining: Math.max(0, limits.tradesPerDay - todayTrades),
    importsRemaining: Math.max(0, limits.maxImportsPerDay - todayImports),
    canLogTrade: todayTrades < limits.tradesPerDay,
    canImport: todayImports < limits.maxImportsPerDay,
    aiThisWeek,
    aiRemainingWeek: Math.max(0, limits.aiPerWeek - aiThisWeek),
    canUseAI: aiThisWeek < limits.aiPerWeek,
    incrementAIWeekly,
    canBacktest: limits.canBacktest,
    canPropFirm: limits.canPropFirm,
    canPlaybooks: limits.canPlaybooks,
    canExportCSV: limits.canExportCSV,

    incrementTrades,
    incrementAI,
    incrementImports,
  }
}
