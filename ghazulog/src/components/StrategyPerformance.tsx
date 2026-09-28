'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface StratRow {
  strategy: string
  trades: number
  wins: number
  winRate: number
  netPnl: number
  avgR: number
}

const fmt = (v: number) => { const a = Math.abs(v).toFixed(2); return v >= 0 ? `+$${a}` : `-$${a}` }

export default function StrategyPerformance() {
  const supabase = createClient()
  const [rows, setRows] = useState<StratRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('backtest_trades').select('*')
      const trades = data || []

      // group by strategy (skip null/empty)
      const groups: Record<string, any[]> = {}
      trades.forEach(t => {
        const key = (t.strategy && String(t.strategy).trim()) || 'Untagged'
        if (!groups[key]) groups[key] = []
        groups[key].push(t)
      })

      const result: StratRow[] = Object.entries(groups).map(([strategy, ts]) => {
        const wins = ts.filter(t => (t.net_pnl || 0) > 0)
        const netPnl = ts.reduce((a, t) => a + (t.net_pnl || 0), 0)
        const avgR = ts.length ? ts.reduce((a, t) => a + (t.r_multiple || 0), 0) / ts.length : 0
        return {
          strategy,
          trades: ts.length,
          wins: wins.length,
          winRate: ts.length ? (wins.length / ts.length) * 100 : 0,
          netPnl,
          avgR,
        }
      })

      // sort best net P&L first
      result.sort((a, b) => b.netPnl - a.netPnl)
      setRows(result)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'10px', padding:'16px', marginBottom:'20px' }}>
      <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'16px', display:'flex', justifyContent:'space-between' }}>
        <span>Strategy Performance</span>
        <span style={{ fontSize:'11px', color:'#8b949e' }}>Backtest trades</span>
      </div>

      {loading ? (
        <div style={{ height:'80px', display:'flex', alignItems:'center', justifyContent:'center', color:'#8b949e', fontSize:'13px' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ height:'80px', display:'flex', alignItems:'center', justifyContent:'center', color:'#8b949e', fontSize:'13px' }}>
          No backtest trades yet. Log trades with a strategy name to see performance here.
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['Strategy','Trades','Win Rate','Net P&L','Avg R'].map(h => (
                <th key={h} style={{ textAlign: h==='Strategy'?'left':'right', fontSize:'11px', color:'#8b949e', fontWeight:'500', padding:'0 0 10px', borderBottom:'1px solid #21262d' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.strategy} style={{ borderBottom:'1px solid #21262d' }}>
                <td style={{ padding:'10px 0', fontSize:'13px', fontWeight:'500', color:'#e6edf3' }}>{r.strategy}</td>
                <td style={{ padding:'10px 0', fontSize:'13px', color:'#8b949e', textAlign:'right' }}>{r.trades}</td>
                <td style={{ padding:'10px 0', fontSize:'13px', textAlign:'right', color: r.winRate>=50?'#3fb950':'#e6edf3' }}>{r.winRate.toFixed(0)}%</td>
                <td style={{ padding:'10px 0', fontSize:'13px', fontWeight:'600', textAlign:'right', color: r.netPnl>=0?'#3fb950':'#f85149' }}>{fmt(r.netPnl)}</td>
                <td style={{ padding:'10px 0', fontSize:'13px', textAlign:'right', color: r.avgR>=0?'#79c0ff':'#f85149' }}>{r.avgR.toFixed(2)}R</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
