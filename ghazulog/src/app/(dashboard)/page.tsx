'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchTrades() {
      const { data } = await supabase
        .from('trades')
        .select('*')
        .order('trade_date', { ascending: true })
      setTrades(data || [])
      setLoading(false)
    }
    fetchTrades()
  }, [])

  // Calculate stats
  const closed = trades.filter(t => t.status === 'closed')
  const winners = closed.filter(t => (t.net_pnl || 0) > 0)
  const losers = closed.filter(t => (t.net_pnl || 0) <= 0)
  const totalPnl = closed.reduce((s, t) => s + (t.net_pnl || 0), 0)
  const winRate = closed.length ? (winners.length / closed.length) * 100 : 0
  const grossWin = winners.reduce((s, t) => s + (t.net_pnl || 0), 0)
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.net_pnl || 0), 0))
  const profitFactor = grossLoss === 0 ? grossWin : grossWin / grossLoss
  const avgWin = winners.length ? grossWin / winners.length : 0
  const avgLoss = losers.length ? grossLoss / losers.length : 0
  const avgRR = avgLoss === 0 ? 0 : avgWin / avgLoss

  // Equity curve data
  let running = 0
  const equityData = closed.map(t => {
    running += t.net_pnl || 0
    return { date: t.trade_date?.slice(5), pnl: parseFloat(running.toFixed(2)) }
  })

  // Daily PnL bar chart
  const dailyMap: Record<string, number> = {}
  closed.forEach(t => {
    const d = t.trade_date?.slice(5) || ''
    dailyMap[d] = (dailyMap[d] || 0) + (t.net_pnl || 0)
  })
  const dailyData = Object.entries(dailyMap).slice(-14).map(([date, pnl]) => ({
    date, pnl: parseFloat(pnl.toFixed(2))
  }))

  const fmt = (v: number) => {
    const abs = Math.abs(v).toFixed(2)
    return v >= 0 ? `+$${abs}` : `-$${abs}`
  }

  const stats = [
    { label: 'Net P&L',       value: fmt(totalPnl),              color: totalPnl >= 0 ? '#3fb950' : '#f85149', bg: totalPnl >= 0 ? '#0f3d2e' : '#3d0f0f' },
    { label: 'Win Rate',      value: `${winRate.toFixed(1)}%`,   color: '#e6edf3', bg: '#161b22' },
    { label: 'Profit Factor', value: profitFactor.toFixed(2),    color: profitFactor >= 1 ? '#3fb950' : '#f85149', bg: '#161b22' },
    { label: 'Avg R:R',       value: `${avgRR.toFixed(2)}R`,     color: '#79c0ff', bg: '#161b22' },
    { label: 'Total Trades',  value: closed.length.toString(),   color: '#e6edf3', bg: '#161b22' },
    { label: 'Best Trade',    value: closed.length ? fmt(Math.max(...closed.map(t => t.net_pnl || 0))) : '$0', color: '#3fb950', bg: '#0f3d2e' },
  ]

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <p style={{ color:'#8b949e' }}>Loading your trades...</p>
    </div>
  )

  return (
    <div style={{ maxWidth:'1200px' }}>

      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'600', color:'#e6edf3', margin:'0 0 4px' }}>
          Dashboard
        </h1>
        <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>
          {closed.length === 0 ? 'No trades yet — add your first trade to see stats' : `Showing stats for ${closed.length} closed trades`}
        </p>
      </div>

      {/* Stats Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'12px', marginBottom:'20px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: s.bg, border:'1px solid #21262d', borderRadius:'10px', padding:'16px 20px' }}>
            <div style={{ fontSize:'11px', color:'#8b949e', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>{s.label}</div>
            <div style={{ fontSize:'26px', fontWeight:'600', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px', marginBottom:'20px' }}>

        {/* Equity Curve */}
        <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Equity Curve</span>
            <span style={{ fontSize:'12px', color: totalPnl >= 0 ? '#3fb950' : '#f85149' }}>{fmt(totalPnl)} total</span>
          </div>
          {equityData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={equityData}>
                <XAxis dataKey="date" tick={{ fontSize:10, fill:'#8b949e' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize:10, fill:'#8b949e' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background:'#161b22', border:'1px solid #30363d', borderRadius:'8px', fontSize:'12px' }}
                  labelStyle={{ color:'#8b949e' }}
                  formatter={(v: any) => [`$${v}`, 'P&L']}
                />
                <Line type="monotone" dataKey="pnl" stroke="#00d4aa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:'160px', display:'flex', alignItems:'center', justifyContent:'center', color:'#8b949e', fontSize:'13px' }}>
              Add trades to see your equity curve
            </div>
          )}
        </div>

        {/* Win Rate Circle */}
        <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
          <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'16px' }}>Win Rate</div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'160px', gap:'12px' }}>
            <svg width="100" height="100" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#21262d" strokeWidth="10"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#3fb950" strokeWidth="10"
                strokeDasharray={`${(winRate/100)*251} 251`}
                strokeDashoffset="63" strokeLinecap="round"
                transform="rotate(-90 50 50)"/>
              <text x="50" y="54" textAnchor="middle" fontSize="16" fontWeight="600" fill="#e6edf3">{winRate.toFixed(0)}%</text>
            </svg>
            <div style={{ display:'flex', gap:'16px' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'16px', fontWeight:'600', color:'#3fb950' }}>{winners.length}</div>
                <div style={{ fontSize:'10px', color:'#8b949e' }}>Wins</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'16px', fontWeight:'600', color:'#f85149' }}>{losers.length}</div>
                <div style={{ fontSize:'10px', color:'#8b949e' }}>Losses</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily PnL Bar Chart */}
      <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px', marginBottom:'20px' }}>
        <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'16px' }}>Daily P&L (Last 14 Days)</div>
        {dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fontSize:10, fill:'#8b949e' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize:10, fill:'#8b949e' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ background:'#161b22', border:'1px solid #30363d', borderRadius:'8px', fontSize:'12px' }}
                formatter={(v: any) => [`$${v}`, 'P&L']}
              />
              <Bar dataKey="pnl" radius={[4,4,0,0]}>
                {dailyData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? '#3fb950' : '#f85149'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ height:'140px', display:'flex', alignItems:'center', justifyContent:'center', color:'#8b949e', fontSize:'13px' }}>
            Add trades to see daily P&L
          </div>
        )}
      </div>

      {/* Recent Trades */}
      <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
        <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'16px', display:'flex', justifyContent:'space-between' }}>
          <span>Recent Trades</span>
          <a href="/journal" style={{ fontSize:'12px', color:'#00d4aa', textDecoration:'none' }}>View all →</a>
        </div>
        {trades.length === 0 ? (
          <div style={{ padding:'32px', textAlign:'center' }}>
            <div style={{ fontSize:'32px', marginBottom:'12px' }}>📓</div>
            <p style={{ color:'#8b949e', fontSize:'13px', margin:'0 0 16px' }}>No trades yet. Add your first trade!</p>
            <a href="/journal" style={{ padding:'8px 16px', background:'#00d4aa', color:'#0d1117', borderRadius:'8px', fontSize:'13px', fontWeight:'600', textDecoration:'none' }}>
              + Add First Trade
            </a>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Symbol','Direction','Date','Entry','Exit','Net P&L'].map(h => (
                  <th key={h} style={{ textAlign:'left', fontSize:'11px', color:'#8b949e', fontWeight:'500', padding:'0 0 10px', borderBottom:'1px solid #21262d' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.slice(-8).reverse().map(t => (
                <tr key={t.id} style={{ borderBottom:'1px solid #21262d' }}>
                  <td style={{ padding:'10px 0', fontSize:'13px', fontWeight:'500', color:'#e6edf3' }}>{t.symbol}</td>
                  <td style={{ padding:'10px 0' }}>
                    <span style={{ background: t.direction==='long'?'#0f3d2e':'#3d0f0f', color: t.direction==='long'?'#3fb950':'#f85149', borderRadius:'4px', padding:'2px 8px', fontSize:'11px', fontWeight:'500' }}>
                      {t.direction}
                    </span>
                  </td>
                  <td style={{ padding:'10px 0', fontSize:'12px', color:'#8b949e' }}>{t.trade_date}</td>
                  <td style={{ padding:'10px 0', fontSize:'12px', color:'#8b949e' }}>${t.entry_price}</td>
                  <td style={{ padding:'10px 0', fontSize:'12px', color:'#8b949e' }}>{t.exit_price ? `$${t.exit_price}` : '—'}</td>
                  <td style={{ padding:'10px 0', fontSize:'13px', fontWeight:'600', color: (t.net_pnl||0) >= 0 ? '#3fb950' : '#f85149' }}>
                    {fmt(t.net_pnl || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  )
}