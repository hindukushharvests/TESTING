'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => {
  const a = Math.abs(v).toFixed(2)
  return v >= 0 ? `+$${a}` : `-$${a}`
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ImportReportsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [imports, setImports] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview'|'tradelog'|'broker'|'calendar'>('overview')
  const [filterBroker, setFilterBroker] = useState<string>('all')
  const [calMonth, setCalMonth] = useState(new Date())
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: importsData } = await supabase.from('trade_imports').select('*').eq('user_id', user.id).order('imported_at', { ascending: false })
    const { data: tradesData } = await supabase.from('imported_trades').select('*').eq('user_id', user.id).order('trade_date', { ascending: true })
    setImports(importsData || [])
    setTrades(tradesData || [])
    setLoading(false)
  }

  async function handleDeleteImport(id: string) {
    await supabase.from('imported_trades').delete().eq('import_id', id)
    await supabase.from('trade_imports').delete().eq('id', id)
    setConfirmDelete(null)
    load()
  }

  function handleExport() {
    const data = filterBroker === 'all' ? trades : trades.filter(t => t.broker === filterBroker)
    const headers = ['Date','Symbol','Direction','Entry','Exit','Quantity','Net P&L','Commission','Broker']
    const rows = data.map(t => [t.trade_date, t.symbol, t.direction, t.entry_price||'', t.exit_price||'', t.quantity||'', t.net_pnl||0, t.commission||0, t.broker||''])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ghazulog-export-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ color:'#8b949e' }}>Loading reports...</div>
    </div>
  )

  if (trades.length === 0) return (
    <div style={{ maxWidth:'600px', fontFamily:'-apple-system,sans-serif' }}>
      <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e6edf3', margin:'0 0 8px' }}>📊 Import Report</h1>
      <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'12px', padding:'48px', textAlign:'center' }}>
        <div style={{ fontSize:'40px', marginBottom:'12px' }}>📭</div>
        <p style={{ color:'#8b949e', fontSize:'14px', marginBottom:'16px' }}>No imported trades yet</p>
        <button onClick={()=>router.push('/import')} style={{ background:'#00d4aa', border:'none', borderRadius:'8px', padding:'10px 20px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          → Import CSV
        </button>
      </div>
    </div>
  )

  const filtered = filterBroker === 'all' ? trades : trades.filter(t => t.broker === filterBroker)
  const wins = filtered.filter(t => (t.net_pnl||0) > 0)
  const losses = filtered.filter(t => (t.net_pnl||0) < 0)
  const breakeven = filtered.filter(t => (t.net_pnl||0) === 0)
  const totalPnl = filtered.reduce((s,t) => s+(t.net_pnl||0), 0)
  const wr = filtered.length ? wins.length / filtered.length * 100 : 0
  const totalCommission = filtered.reduce((s,t) => s + Math.abs(t.commission||0), 0)
  const avgPerTrade = filtered.length ? totalPnl / filtered.length : 0

  const BROKER_ICONS: Record<string,string> = { 'Binance':'🔶','MetaTrader 4':'📊','MetaTrader 5':'📈','Bybit':'🟡','Interactive Brokers':'🏛️' }
  const brokerStats: Record<string, { count: number; pnl: number; wins: number; icon: string }> = {}
  trades.forEach(t => {
    const b = t.broker || 'Unknown'
    if (!brokerStats[b]) brokerStats[b] = { count: 0, pnl: 0, wins: 0, icon: BROKER_ICONS[b]||'📁' }
    brokerStats[b].count++
    brokerStats[b].pnl += t.net_pnl || 0
    if ((t.net_pnl||0) > 0) brokerStats[b].wins++
  })
  const brokerEntries = Object.entries(brokerStats).sort((a,b) => b[1].pnl - a[1].pnl)
  const maxBrokerPnl = Math.max(...brokerEntries.map(([,s]) => Math.abs(s.pnl)), 1)

  const monthMap: Record<string, number> = {}
  filtered.forEach(t => {
    const d = new Date(t.trade_date)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    monthMap[key] = (monthMap[key] || 0) + (t.net_pnl||0)
  })
  const monthEntries = Object.entries(monthMap).sort().slice(-8)
  const maxMonthAbs = Math.max(...monthEntries.map(([,v]) => Math.abs(v)), 1)

  const dailyMap: Record<string, { pnl: number; count: number }> = {}
  filtered.forEach(t => {
    const d = t.trade_date
    if (!dailyMap[d]) dailyMap[d] = { pnl: 0, count: 0 }
    dailyMap[d].pnl += t.net_pnl || 0
    dailyMap[d].count++
  })
  const dailyPnls = Object.values(dailyMap).map(d => d.pnl)
  const bestDayValue = dailyPnls.length ? Math.max(...dailyPnls) : 0
  const worstDayValue = dailyPnls.length ? Math.min(...dailyPnls) : 0
  const bestDayDate = Object.entries(dailyMap).find(([,d])=>d.pnl===bestDayValue)?.[0]
  const worstDayDate = Object.entries(dailyMap).find(([,d])=>d.pnl===worstDayValue)?.[0]

  const symMap: Record<string,number> = {}
  filtered.forEach(t => { symMap[t.symbol] = (symMap[t.symbol]||0) + (t.net_pnl||0) })
  const bestSymbol = Object.entries(symMap).sort((a,b)=>b[1]-a[1])[0]
  const recentTrades = [...filtered].sort((a,b) => (b.trade_date||'').localeCompare(a.trade_date||'')).slice(0,10)

  const calYear = calMonth.getFullYear()
  const calMon = calMonth.getMonth()
  const firstDay = new Date(calYear, calMon, 1).getDay()
  const daysInMonth = new Date(calYear, calMon+1, 0).getDate()
  const calCells: ({ day: number; pnl: number; count: number } | null)[] = []
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  for (let i = 0; i < startOffset; i++) calCells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMon+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const data = dailyMap[key] || { pnl: 0, count: 0 }
    calCells.push({ day: d, pnl: data.pnl, count: data.count })
  }

  const card: React.CSSProperties = { background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px' }

  return (
    <div style={{ maxWidth:'1200px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px', letterSpacing:'-0.5px' }}>📊 Import Report</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>
            All imported trades across {Object.keys(brokerStats).length} broker{Object.keys(brokerStats).length>1?'s':''}
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <select value={filterBroker} onChange={e=>setFilterBroker(e.target.value)}
            style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'12px', padding:'8px 12px', outline:'none', cursor:'pointer' }}>
            <option value="all">🔍 All Brokers ({trades.length})</option>
            {Object.entries(brokerStats).map(([b,s])=>(<option key={b} value={b}>{s.icon} {b} ({s.count})</option>))}
          </select>
          <button onClick={handleExport} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'8px', padding:'8px 14px', color:'#e6edf3', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>⬇️ Export</button>
          <button onClick={()=>router.push('/import')} style={{ background:'#00d4aa', border:'none', borderRadius:'8px', padding:'8px 14px', color:'#0d1117', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>⬆️ New Import</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #21262d', marginBottom:'16px' }}>
        {([['overview','Overview'],['tradelog','Trade Log'],['broker','By Broker'],['calendar','Calendar']] as [string,string][]).map(([k,l]) => (
          <button key={k} onClick={()=>setActiveTab(k as any)}
            style={{ padding:'10px 18px', fontSize:'13px', cursor:'pointer', border:'none',
              borderBottom:`2px solid ${activeTab===k?'#00d4aa':'transparent'}`,
              background:'transparent', color: activeTab===k?'#00d4aa':'#8b949e',
              fontWeight: activeTab===k?'600':'400' }}>{l}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'12px' }}>
            <div style={{ ...card, padding:'18px' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Total Imported</div>
              <div style={{ fontSize:'24px', fontWeight:'800', color:'#e6edf3' }}>{filtered.length.toLocaleString()}</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'4px' }}>trades</div>
            </div>
            <div style={{ ...card, padding:'18px', background: totalPnl>=0?'linear-gradient(135deg,rgba(63,185,80,0.08),#161b22)':'linear-gradient(135deg,rgba(248,81,73,0.08),#161b22)', border:`1px solid ${totalPnl>=0?'rgba(63,185,80,0.25)':'rgba(248,81,73,0.25)'}` }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Net P&L</div>
              <div style={{ fontSize:'24px', fontWeight:'800', color: totalPnl>=0?'#3fb950':'#f85149' }}>{fmt(totalPnl)}</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'4px' }}>after commissions</div>
            </div>
            <div style={{ ...card, padding:'18px' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Win Rate</div>
              <div style={{ fontSize:'24px', fontWeight:'800', color: wr>=50?'#3fb950':'#e3b341' }}>{wr.toFixed(1)}%</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'4px' }}>{wins.length}W / {losses.length}L</div>
            </div>
            <div style={{ ...card, padding:'18px' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Total Commission</div>
              <div style={{ fontSize:'24px', fontWeight:'800', color:'#f85149' }}>-${totalCommission.toFixed(0)}</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'4px' }}>across brokers</div>
            </div>
            <div style={{ ...card, padding:'18px' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>Avg Trade</div>
              <div style={{ fontSize:'24px', fontWeight:'800', color: avgPerTrade>=0?'#3fb950':'#f85149' }}>{fmt(avgPerTrade)}</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'4px' }}>per trade</div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div style={{ ...card, padding:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>P&L by Broker</div>
                <div style={{ fontSize:'11px', color:'#8b949e' }}>all time</div>
              </div>
              {brokerEntries.map(([b,s]) => {
                const brokerWR = s.wins / s.count * 100
                return (
                  <div key={b} style={{ marginBottom:'14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px' }}>
                      <span style={{ fontSize:'18px' }}>{s.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3' }}>{b}</div>
                        <div style={{ fontSize:'10px', color:'#8b949e' }}>{s.count} trades · {brokerWR.toFixed(0)}% WR</div>
                      </div>
                      <span style={{ fontSize:'14px', fontWeight:'700', color: s.pnl>=0?'#3fb950':'#f85149' }}>{fmt(s.pnl)}</span>
                    </div>
                    <div style={{ height:'6px', background:'#21262d', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${Math.abs(s.pnl)/maxBrokerPnl*100}%`, height:'100%', background: s.pnl>=0?'linear-gradient(90deg,#00d4aa,#3fb950)':'linear-gradient(90deg,#f85149,#da3633)', borderRadius:'3px' }}/>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ ...card, padding:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Win / Loss Breakdown</div>
                <div style={{ fontSize:'11px', color:'#8b949e' }}>{filtered.length} trades</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'24px', marginBottom:'20px' }}>
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#21262d" strokeWidth="10"/>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#3fb950" strokeWidth="10" strokeDasharray={`${(wr/100)*251} 251`} strokeLinecap="round" transform="rotate(-90 50 50)"/>
                  <text x="50" y="55" textAnchor="middle" fontSize="18" fontWeight="800" fill="#e6edf3">{wr.toFixed(0)}%</text>
                </svg>
                <div style={{ flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#e6edf3' }}><span style={{ width:'10px', height:'10px', borderRadius:'50%', background:'#3fb950' }}/>Winners</span><span style={{ fontSize:'14px', fontWeight:'700', color:'#3fb950' }}>{wins.length}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#e6edf3' }}><span style={{ width:'10px', height:'10px', borderRadius:'50%', background:'#f85149' }}/>Losers</span><span style={{ fontSize:'14px', fontWeight:'700', color:'#f85149' }}>{losses.length}</span></div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#e6edf3' }}><span style={{ width:'10px', height:'10px', borderRadius:'50%', background:'#8b949e' }}/>Break even</span><span style={{ fontSize:'14px', fontWeight:'700', color:'#8b949e' }}>{breakeven.length}</span></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:'12px', color:'#8b949e', marginBottom:'10px' }}>Monthly P&L</div>
                <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', height:'90px' }}>
                  {monthEntries.length === 0 ? <div style={{ color:'#8b949e', fontSize:'12px' }}>No data</div> : monthEntries.map(([m,v]) => {
                    const h = (Math.abs(v) / maxMonthAbs) * 100
                    const [y,mo] = m.split('-')
                    return (
                      <div key={m} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%' }} title={`${m}: ${fmt(v)}`}>
                        <div style={{ flex:1, display:'flex', alignItems:'flex-end', width:'100%' }}>
                          <div style={{ width:'100%', height:`${h}%`, minHeight:'3px', background: v>=0?'#3fb950':'#f85149', borderRadius:'3px 3px 0 0' }}/>
                        </div>
                        <div style={{ fontSize:'9px', color:'#8b949e', marginTop:'4px' }}>{MONTHS[+mo-1]}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <div style={{ ...card, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Recent Trades</div>
                <span style={{ fontSize:'11px', color:'#8b949e' }}>{filterBroker === 'all' ? 'all brokers' : filterBroker}</span>
              </div>
              <div style={{ maxHeight:'320px', overflowY:'auto' }}>
                {recentTrades.map((t,i)=>(
                  <div key={i} style={{ padding:'10px 18px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <span style={{ fontSize:'12px', fontWeight:'700', color:'#e6edf3', minWidth:'70px' }}>{t.symbol}</span>
                      <span style={{ background: t.direction==='long'?'#0f3d2e':'#3d0f0f', color: t.direction==='long'?'#3fb950':'#f85149', fontSize:'9px', padding:'2px 7px', borderRadius:'4px', fontWeight:'700', textTransform:'uppercase' }}>{t.direction}</span>
                      <span style={{ fontSize:'10px', color:'#8b949e' }}>{t.broker} · {t.trade_date}</span>
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:'700', color: (t.net_pnl||0)>=0?'#3fb950':'#f85149' }}>{fmt(t.net_pnl||0)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ ...card, overflow:'hidden' }}>
              <div style={{ padding:'14px 18px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Import History</div>
                <span style={{ fontSize:'11px', color:'#8b949e' }}>{imports.length} sessions</span>
              </div>
              <div style={{ maxHeight:'320px', overflowY:'auto' }}>
                {imports.map(imp => (
                  <div key={imp.id} style={{ padding:'12px 18px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', marginBottom:'2px' }}>{BROKER_ICONS[imp.broker]||'📁'} {imp.broker}</div>
                      <div style={{ fontSize:'10px', color:'#8b949e', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{imp.file_name}</div>
                      <div style={{ fontSize:'10px', color:'#8b949e' }}>{imp.trade_count} trades · {new Date(imp.imported_at).toLocaleDateString()}</div>
                    </div>
                    {confirmDelete === imp.id ? (
                      <div style={{ display:'flex', gap:'4px' }}>
                        <button onClick={()=>handleDeleteImport(imp.id)} style={{ background:'#f85149', border:'none', borderRadius:'5px', padding:'4px 8px', color:'#fff', fontSize:'10px', cursor:'pointer', fontWeight:'700' }}>Yes Delete</button>
                        <button onClick={()=>setConfirmDelete(null)} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'5px', padding:'4px 8px', color:'#8b949e', fontSize:'10px', cursor:'pointer' }}>Cancel</button>
                      </div>
                    ) : (
                      <button onClick={()=>setConfirmDelete(imp.id)} style={{ background:'transparent', border:'1px solid #30363d', borderRadius:'5px', padding:'4px 8px', color:'#f85149', fontSize:'10px', cursor:'pointer' }}>🗑️ Delete</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ padding:'12px 18px', borderTop:'1px solid #21262d', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'11px', color:'#8b949e' }}>{trades.length} trades total</span>
                <button onClick={()=>router.push('/import')} style={{ background:'#00d4aa', border:'none', borderRadius:'6px', padding:'6px 12px', color:'#0d1117', fontSize:'11px', fontWeight:'700', cursor:'pointer' }}>⬆️ Import more</button>
              </div>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
            <div style={{ ...card, padding:'16px', background:'linear-gradient(135deg,rgba(63,185,80,0.08),#161b22)', border:'1px solid rgba(63,185,80,0.25)' }}>
              <div style={{ fontSize:'11px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>🏆 Best Day</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:'#3fb950', marginBottom:'2px' }}>{fmt(bestDayValue)}</div>
              <div style={{ fontSize:'11px', color:'#8b949e' }}>{bestDayDate || '—'}</div>
            </div>
            <div style={{ ...card, padding:'16px', background:'linear-gradient(135deg,rgba(248,81,73,0.08),#161b22)', border:'1px solid rgba(248,81,73,0.25)' }}>
              <div style={{ fontSize:'11px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>💥 Worst Day</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:'#f85149', marginBottom:'2px' }}>{fmt(worstDayValue)}</div>
              <div style={{ fontSize:'11px', color:'#8b949e' }}>{worstDayDate || '—'}</div>
            </div>
            {bestSymbol && (
              <div style={{ ...card, padding:'16px' }}>
                <div style={{ fontSize:'11px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>💎 Best Symbol</div>
                <div style={{ fontSize:'20px', fontWeight:'800', color:'#e6edf3', marginBottom:'2px' }}>{bestSymbol[0]}</div>
                <div style={{ fontSize:'11px', color:'#3fb950' }}>{fmt(bestSymbol[1])} total P&L</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* TRADE LOG */}
      {activeTab === 'tradelog' && (
        <div style={{ ...card, overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Trade Log · {filtered.length} trades</div>
            <button onClick={handleExport} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'6px', padding:'5px 12px', color:'#e6edf3', fontSize:'11px', cursor:'pointer' }}>⬇️ Export CSV</button>
          </div>
          <div style={{ overflowX:'auto', maxHeight:'600px', overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#0d1117', position:'sticky', top:0 }}>
                  {['#','Date','Symbol','Side','Broker','Entry','Exit','Qty','Net P&L'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'10px', color:'#8b949e', fontWeight:'600', textTransform:'uppercase', borderBottom:'1px solid #21262d', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...filtered].reverse().map((t,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid #21262d', borderLeft:`2px solid ${(t.net_pnl||0)>=0?'#3fb950':'#f85149'}` }}>
                    <td style={{ padding:'8px 14px', fontSize:'10px', color:'#8b949e' }}>{i+1}</td>
                    <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e', whiteSpace:'nowrap' }}>{t.trade_date}</td>
                    <td style={{ padding:'8px 14px', fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{t.symbol}</td>
                    <td style={{ padding:'8px 14px' }}>
                      <span style={{ background:t.direction==='long'?'#0f3d2e':'#3d0f0f', color:t.direction==='long'?'#3fb950':'#f85149', fontSize:'10px', padding:'2px 7px', borderRadius:'4px', fontWeight:'700', textTransform:'uppercase' }}>{t.direction}</span>
                    </td>
                    <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{BROKER_ICONS[t.broker]||''} {t.broker}</td>
                    <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{t.entry_price?`$${Number(t.entry_price).toFixed(4)}`:'—'}</td>
                    <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{t.exit_price?`$${Number(t.exit_price).toFixed(4)}`:'—'}</td>
                    <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{t.quantity||'—'}</td>
                    <td style={{ padding:'8px 14px', fontSize:'12px', fontWeight:'700', color:(t.net_pnl||0)>=0?'#3fb950':'#f85149', whiteSpace:'nowrap' }}>{fmt(t.net_pnl||0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BY BROKER */}
      {activeTab === 'broker' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
          {brokerEntries.map(([b,s]) => {
            const bt = trades.filter(t => t.broker === b)
            const bw = bt.filter(t => (t.net_pnl||0)>0)
            const bwr = bt.length ? bw.length / bt.length * 100 : 0
            const gw = bw.reduce((s,t)=>s+(t.net_pnl||0),0)
            const gl = Math.abs(bt.filter(t=>(t.net_pnl||0)<0).reduce((s,t)=>s+(t.net_pnl||0),0))
            const pf = gl===0?gw:gw/gl
            return (
              <div key={b} style={{ ...card, padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
                  <span style={{ fontSize:'28px' }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize:'16px', fontWeight:'700', color:'#e6edf3' }}>{b}</div>
                    <div style={{ fontSize:'11px', color:'#8b949e' }}>{s.count} trades · {bwr.toFixed(1)}% WR</div>
                  </div>
                  <div style={{ marginLeft:'auto' }}><div style={{ fontSize:'20px', fontWeight:'800', color:s.pnl>=0?'#3fb950':'#f85149' }}>{fmt(s.pnl)}</div></div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                  {[['Wins',bw.length,'#3fb950'],['Losses',bt.length-bw.length,'#f85149'],['PF',pf.toFixed(2),pf>=1?'#3fb950':'#f85149'],['Avg',fmt(s.pnl/s.count),s.pnl>=0?'#3fb950':'#f85149']].map(([l,v,c])=>(
                    <div key={l as string} style={{ background:'#0d1117', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                      <div style={{ fontSize:'9px', color:'#8b949e', textTransform:'uppercase' }}>{l}</div>
                      <div style={{ fontSize:'15px', fontWeight:'700', color:c as string }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CALENDAR */}
      {activeTab === 'calendar' && (
        <div style={{ ...card, padding:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'20px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Trading Calendar</div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <button onClick={()=>setCalMonth(new Date(calYear, calMon-1))} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'6px', padding:'5px 10px', color:'#8b949e', cursor:'pointer' }}>‹</button>
              <span style={{ fontSize:'13px', color:'#e6edf3', fontWeight:'600', minWidth:'120px', textAlign:'center' }}>{MONTHS[calMon]} {calYear}</span>
              <button onClick={()=>setCalMonth(new Date(calYear, calMon+1))} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'6px', padding:'5px 10px', color:'#8b949e', cursor:'pointer' }}>›</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px', marginBottom:'8px' }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(<div key={d} style={{ textAlign:'center', fontSize:'11px', color:'#8b949e', fontWeight:'600', padding:'8px' }}>{d}</div>))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px' }}>
            {calCells.map((c,i)=>{
              if (!c) return <div key={i}/>
              const bg = c.pnl > 0 ? 'rgba(63,185,80,0.15)' : c.pnl < 0 ? 'rgba(248,81,73,0.15)' : '#161b22'
              const border = c.pnl > 0 ? 'rgba(63,185,80,0.3)' : c.pnl < 0 ? 'rgba(248,81,73,0.3)' : '#21262d'
              return (
                <div key={i} style={{ background:bg, border:`1px solid ${border}`, borderRadius:'8px', padding:'10px 8px', minHeight:'70px' }}>
                  <div style={{ fontSize:'12px', color:'#8b949e', marginBottom:'6px' }}>{c.day}</div>
                  {c.count > 0 && (<>
                    <div style={{ fontSize:'11px', fontWeight:'700', color: c.pnl>=0?'#3fb950':'#f85149' }}>{fmt(c.pnl)}</div>
                    <div style={{ fontSize:'9px', color:'#8b949e' }}>{c.count} trade{c.count>1?'s':''}</div>
                  </>)}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ height:'40px' }}/>
    </div>
  )
}
