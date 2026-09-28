import { Trade, DashboardStats } from '@/types'

export function calculateStats(trades: Trade[]): DashboardStats {
  const closed = trades.filter(t => t.status === 'closed' && t.net_pnl !== null)

  if (closed.length === 0) {
    return {
      totalNetPnl: 0, winRate: 0, profitFactor: 0,
      avgRR: 0, totalTrades: 0, maxDrawdown: 0,
      bestTrade: 0, worstTrade: 0, avgWin: 0, avgLoss: 0
    }
  }

  const winners = closed.filter(t => (t.net_pnl ?? 0) > 0)
  const losers  = closed.filter(t => (t.net_pnl ?? 0) <= 0)

  const totalNetPnl   = closed.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const totalGrossWin = winners.reduce((s, t) => s + (t.net_pnl ?? 0), 0)
  const totalGrossLoss = Math.abs(losers.reduce((s, t) => s + (t.net_pnl ?? 0), 0))

  const winRate      = (winners.length / closed.length) * 100
  const profitFactor = totalGrossLoss === 0 ? totalGrossWin : totalGrossWin / totalGrossLoss
  const avgWin       = winners.length ? totalGrossWin / winners.length : 0
  const avgLoss      = losers.length  ? totalGrossLoss / losers.length : 0
  const avgRR        = avgLoss === 0  ? 0 : avgWin / avgLoss
  const bestTrade    = Math.max(...closed.map(t => t.net_pnl ?? 0))
  const worstTrade   = Math.min(...closed.map(t => t.net_pnl ?? 0))

  // Max drawdown calculation
  let peak = 0, maxDrawdown = 0, running = 0
  for (const t of closed) {
    running += t.net_pnl ?? 0
    if (running > peak) peak = running
    const dd = peak - running
    if (dd > maxDrawdown) maxDrawdown = dd
  }

  return {
    totalNetPnl, winRate, profitFactor, avgRR,
    totalTrades: closed.length, maxDrawdown,
    bestTrade, worstTrade, avgWin, avgLoss
  }
}

export function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2
  }).format(abs)
  return value >= 0 ? `+${formatted}` : `-${formatted}`
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function getEquityCurve(trades: Trade[]) {
  const closed = trades
    .filter(t => t.status === 'closed')
    .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime())

  let running = 0
  return closed.map(t => {
    running += t.net_pnl ?? 0
    return { date: t.trade_date, pnl: running, trade_pnl: t.net_pnl ?? 0 }
  })
}