'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const fmt = (v: number) => { const a = Math.abs(v).toFixed(2); return v >= 0 ? `+$${a}` : `-$${a}` }
const fmt0 = (v: number) => { const a = Math.abs(v).toFixed(0); return v >= 0 ? `+$${a}` : `-$${a}` }

export default function ReportsPage() {
  const supabase = createClient()
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'calendar'|'analytics'>('analytics')
  const [calLevel, setCalLevel] = useState<'month'|'year'|'day'>('month')
  const [cursor, setCursor] = useState(new Date())

  useEffect(() => {
    supabase.from('trades').select('*').order('trade_date', { ascending: true }).then(({ data }) => {
      setTrades(data || [])
      setLoading(false)
    })
  }, [])

  const closed = trades.filter(t => t.status === 'closed')

  // Daily map for calendar
  const dailyMap: Record<string, { pnl: number; trades: any[] }> = {}
  closed.forEach(t => {
    const d = t.trade_date
    if (!d) return
    if (!dailyMap[d]) dailyMap[d] = { pnl: 0, trades: [] }
    dailyMap[d].pnl += t.net_pnl || 0
    dailyMap[d].trades.push(t)
  })

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', color:'#8b949e' }}>Loading reports...</div>

  const card: React.CSSProperties = { background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', padding:'20px' }
  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  // ── ANALYTICS COMPUTATIONS ──
  const wins = closed.filter(t => (t.net_pnl||0) > 0)
  const losses = closed.filter(t => (t.net_pnl||0) <= 0)
  const totalPnl = closed.reduce((s,t)=>s+(t.net_pnl||0),0)
  const wr = closed.length ? wins.length/closed.length*100 : 0
  const grossW = wins.reduce((s,t)=>s+(t.net_pnl||0),0)
  const grossL = Math.abs(losses.reduce((s,t)=>s+(t.net_pnl||0),0))
  const pf = grossL===0?grossW:grossW/grossL
  const avgW = wins.length?grossW/wins.length:0
  const avgL = losses.length?grossL/losses.length:0
  const expectancy = closed.length ? totalPnl/closed.length : 0

  // Streaks
  let maxWin=0, maxLoss=0, cw=0, cl=0
  closed.forEach(t=>{
    if((t.net_pnl||0)>0){ cw++; cl=0; maxWin=Math.max(maxWin,cw) }
    else { cl++; cw=0; maxLoss=Math.max(maxLoss,cl) }
  })

  // Long vs Short
  const longs = closed.filter(t=>t.direction==='long')
  const shorts = closed.filter(t=>t.direction==='short')
  const longWins = longs.filter(t=>(t.net_pnl||0)>0)
  const shortWins = shorts.filter(t=>(t.net_pnl||0)>0)
  const longWR = longs.length?longWins.length/longs.length*100:0
  const shortWR = shorts.length?shortWins.length/shorts.length*100:0
  const longPnl = longs.reduce((s,t)=>s+(t.net_pnl||0),0)
  const shortPnl = shorts.reduce((s,t)=>s+(t.net_pnl||0),0)

  // By symbol
  const bySymbol: Record<string,{pnl:number;wins:number;total:number}> = {}
  closed.forEach(t=>{
    const s=t.symbol||'?'
    if(!bySymbol[s]) bySymbol[s]={pnl:0,wins:0,total:0}
    bySymbol[s].pnl+=t.net_pnl||0; bySymbol[s].total++
    if((t.net_pnl||0)>0) bySymbol[s].wins++
  })
  const symbolData = Object.entries(bySymbol).sort((a,b)=>b[1].pnl-a[1].pnl)
  const maxSymAbs = Math.max(...symbolData.map(([,s])=>Math.abs(s.pnl)),1)

  // By setup tag
  const tagStats: Record<string,{wins:number;total:number;pnl:number}> = {}
  closed.forEach(t=>{
    (t.setup_tags||[]).forEach((tag:string)=>{
      if(!tagStats[tag]) tagStats[tag]={wins:0,total:0,pnl:0}
      tagStats[tag].total++; tagStats[tag].pnl+=t.net_pnl||0
      if((t.net_pnl||0)>0) tagStats[tag].wins++
    })
  })
  const tagData = Object.entries(tagStats).map(([tag,s])=>({ tag, wr:Math.round(s.wins/s.total*100), total:s.total, pnl:s.pnl })).sort((a,b)=>b.wr-a.wr)

  // By day of week
  const dows = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const byDow = dows.map(d=>({ day:d, pnl:0, count:0 }))
  closed.forEach(t=>{ const d=new Date(t.trade_date).getDay(); const i=d===0?6:d-1; byDow[i].pnl+=t.net_pnl||0; byDow[i].count++ })
  const maxDowAbs = Math.max(...byDow.map(d=>Math.abs(d.pnl)),1)

  return (
    <div style={{ maxWidth:'1100px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>📊 Reports</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>{closed.length} closed trades analyzed</p>
        </div>
        <div style={{ display:'flex', gap:'1px', background:'#21262d', borderRadius:'8px', padding:'2px' }}>
          {(['analytics','calendar'] as const).map(v => (
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:'7px 16px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', border:'none', background: view===v?'#00d4aa':'transparent', color: view===v?'#0d1117':'#8b949e', fontWeight: view===v?'700':'400' }}>
              {v === 'calendar' ? '📅 Calendar' : '📈 Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════ ANALYTICS VIEW ═══════ */}
      {view === 'analytics' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

          {/* Hero stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px' }}>
            {[
              { l:'Net P&L', v:fmt0(totalPnl), c:totalPnl>=0?'#3fb950':'#f85149' },
              { l:'Win Rate', v:`${wr.toFixed(0)}%`, c:wr>=50?'#3fb950':'#e3b341' },
              { l:'Profit Factor', v:pf.toFixed(2), c:pf>=1?'#3fb950':'#f85149' },
              { l:'Expectancy', v:fmt0(expectancy), c:expectancy>=0?'#3fb950':'#f85149' },
              { l:'Max Win Streak', v:`${maxWin}`, c:'#3fb950' },
              { l:'Max Loss Streak', v:`${maxLoss}`, c:'#f85149' },
            ].map(s=>(
              <div key={s.l} style={{ ...card, padding:'14px' }}>
                <div style={{ fontSize:'9px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'6px' }}>{s.l}</div>
                <div style={{ fontSize:'20px', fontWeight:'800', color:s.c }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Long vs Short */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            <div style={card}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', marginBottom:'16px' }}>⚔️ Long vs Short Performance</div>
              {[
                { label:'▲ LONG', count:longs.length, wr:longWR, pnl:longPnl, color:'#3fb950' },
                { label:'▼ SHORT', count:shorts.length, wr:shortWR, pnl:shortPnl, color:'#f85149' },
              ].map(d=>(
                <div key={d.label} style={{ marginBottom:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                    <span style={{ fontSize:'12px', color:d.color, fontWeight:'600' }}>{d.label} ({d.count})</span>
                    <span style={{ fontSize:'12px', color:d.pnl>=0?'#3fb950':'#f85149', fontWeight:'700' }}>{fmt0(d.pnl)} · {d.wr.toFixed(0)}% WR</span>
                  </div>
                  <div style={{ height:'10px', background:'#21262d', borderRadius:'5px', overflow:'hidden' }}>
                    <div style={{ width:`${d.wr}%`, height:'100%', background:`linear-gradient(90deg,${d.color},${d.color}aa)`, borderRadius:'5px' }}/>
                  </div>
                </div>
              ))}
              <div style={{ marginTop:'10px', padding:'10px', background:'#0d1117', borderRadius:'8px', fontSize:'11px', color:'#8b949e', lineHeight:'1.5' }}>
                {longWR > shortWR
                  ? `💡 You're stronger on longs (${longWR.toFixed(0)}% vs ${shortWR.toFixed(0)}%). Consider favoring long setups.`
                  : shortWR > longWR
                  ? `💡 You're stronger on shorts (${shortWR.toFixed(0)}% vs ${longWR.toFixed(0)}%). Consider favoring short setups.`
                  : '💡 Balanced performance on both directions.'}
              </div>
            </div>

            {/* Avg win/loss */}
            <div style={card}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', marginBottom:'16px' }}>📐 Risk Metrics</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {[
                  { l:'Average Win', v:fmt(avgW), c:'#3fb950' },
                  { l:'Average Loss', v:`-$${avgL.toFixed(2)}`, c:'#f85149' },
                  { l:'Win/Loss Ratio', v:avgL===0?'∞':(avgW/avgL).toFixed(2), c:'#e3b341' },
                  { l:'Gross Profit', v:fmt(grossW), c:'#3fb950' },
                  { l:'Gross Loss', v:`-$${grossL.toFixed(2)}`, c:'#f85149' },
                ].map(s=>(
                  <div key={s.l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:'10px', borderBottom:'1px solid #21262d' }}>
                    <span style={{ fontSize:'12px', color:'#8b949e' }}>{s.l}</span>
                    <span style={{ fontSize:'14px', fontWeight:'700', color:s.c }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* P&L by Symbol */}
          <div style={card}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', marginBottom:'4px' }}>💎 P&L by Symbol</div>
            <div style={{ fontSize:'11px', color:'#8b949e', marginBottom:'16px' }}>Your best and worst instruments</div>
            {symbolData.slice(0,10).map(([sym,s])=>(
              <div key={sym} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                <span style={{ fontSize:'12px', color:'#e6edf3', width:'80px', fontWeight:'600' }}>{sym}</span>
                <div style={{ flex:1, height:'10px', background:'#21262d', borderRadius:'5px', overflow:'hidden' }}>
                  <div style={{ width:`${Math.abs(s.pnl)/maxSymAbs*100}%`, height:'100%', background:s.pnl>=0?'linear-gradient(90deg,#00d4aa,#3fb950)':'linear-gradient(90deg,#f85149,#da3633)', borderRadius:'5px' }}/>
                </div>
                <span style={{ fontSize:'12px', color:s.pnl>=0?'#3fb950':'#f85149', width:'80px', textAlign:'right', fontWeight:'700' }}>{fmt0(s.pnl)}</span>
                <span style={{ fontSize:'10px', color:'#8b949e', width:'50px', textAlign:'right' }}>{(s.wins/s.total*100).toFixed(0)}% WR</span>
              </div>
            ))}
          </div>

          {/* Win Rate by Setup */}
          {tagData.length > 0 && (
            <div style={card}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', marginBottom:'4px' }}>🎯 Win Rate by Setup</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginBottom:'16px' }}>Which strategies make you money?</div>
              {tagData.map(t=>(
                <div key={t.tag} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                  <span style={{ fontSize:'12px', color:'#e6edf3', width:'100px', fontWeight:'600' }}>{t.tag}</span>
                  <div style={{ flex:1, height:'10px', background:'#21262d', borderRadius:'5px', overflow:'hidden' }}>
                    <div style={{ width:`${t.wr}%`, height:'100%', background: t.wr>=50?'linear-gradient(90deg,#00d4aa,#3fb950)':'linear-gradient(90deg,#e3b341,#d29922)', borderRadius:'5px' }}/>
                  </div>
                  <span style={{ fontSize:'12px', color: t.wr>=50?'#3fb950':'#e3b341', width:'45px', textAlign:'right', fontWeight:'700' }}>{t.wr}%</span>
                  <span style={{ fontSize:'10px', color:'#8b949e', width:'70px', textAlign:'right' }}>{fmt0(t.pnl)} · {t.total}t</span>
                </div>
              ))}
            </div>
          )}

          {/* P&L by Day of Week */}
          <div style={card}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', marginBottom:'4px' }}>📅 P&L by Day of Week</div>
            <div style={{ fontSize:'11px', color:'#8b949e', marginBottom:'16px' }}>Which days are most profitable?</div>
            <div style={{ display:'flex', gap:'8px' }}>
              {byDow.map(d=>{
                const h = Math.abs(d.pnl)/maxDowAbs*100
                return (
                  <div key={d.day} style={{ flex:1, textAlign:'center' }}>
                    <div style={{ height:'100px', display:'flex', alignItems:'flex-end', justifyContent:'center', marginBottom:'6px' }}>
                      <div style={{ width:'70%', height:`${h}%`, minHeight:'3px', background:d.pnl>=0?'#3fb950':'#f85149', borderRadius:'4px 4px 0 0' }} title={fmt(d.pnl)}/>
                    </div>
                    <div style={{ fontSize:'11px', color:'#8b949e', fontWeight:'600' }}>{d.day}</div>
                    <div style={{ fontSize:'10px', color:d.pnl>=0?'#3fb950':'#f85149' }}>{d.count>0?fmt0(d.pnl):'—'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ CALENDAR VIEW ═══════ */}
      {view === 'calendar' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
            <div style={{ display:'flex', gap:'1px', background:'#21262d', borderRadius:'8px', padding:'2px' }}>
              {(['day','month','year'] as const).map(l=>(
                <button key={l} onClick={()=>setCalLevel(l)}
                  style={{ padding:'6px 14px', borderRadius:'6px', fontSize:'12px', cursor:'pointer', border:'none', background: calLevel===l?'#21262d':'transparent', color: calLevel===l?'#e6edf3':'#8b949e', fontWeight: calLevel===l?'600':'400', textTransform:'capitalize', borderBottom: calLevel===l?'2px solid #00d4aa':'2px solid transparent' }}>{l}</button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <button onClick={()=>{ const n=new Date(cursor); if(calLevel==='year')n.setFullYear(year-1); else if(calLevel==='month')n.setMonth(month-1); else n.setDate(cursor.getDate()-1); setCursor(n) }} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'6px', padding:'6px 12px', color:'#8b949e', cursor:'pointer' }}>‹</button>
              <span style={{ fontSize:'15px', fontWeight:'600', color:'#e6edf3', minWidth:'170px', textAlign:'center' }}>
                {calLevel==='year'?year:calLevel==='month'?`${MONTHS[month]} ${year}`:cursor.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}
              </span>
              <button onClick={()=>{ const n=new Date(cursor); if(calLevel==='year')n.setFullYear(year+1); else if(calLevel==='month')n.setMonth(month+1); else n.setDate(cursor.getDate()+1); setCursor(n) }} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'6px', padding:'6px 12px', color:'#8b949e', cursor:'pointer' }}>›</button>
              <button onClick={()=>setCursor(new Date())} style={{ background:'rgba(0,212,170,0.1)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'6px', padding:'6px 12px', color:'#00d4aa', cursor:'pointer', fontSize:'12px' }}>Today</button>
            </div>
          </div>

          {/* YEAR */}
          {calLevel==='year' && (()=>{
            const md = MONTHS_SHORT.map((m,i)=>{
              let pnl=0,count=0
              Object.entries(dailyMap).forEach(([date,d])=>{ if(date.startsWith(`${year}-${String(i+1).padStart(2,'0')}`)){ pnl+=d.pnl; count+=d.trades.length } })
              return { month:m, idx:i, pnl, count }
            })
            const yt=md.reduce((s,m)=>s+m.pnl,0), ytr=md.reduce((s,m)=>s+m.count,0)
            return (<>
              <div style={{ ...card, marginBottom:'16px', display:'flex', justifyContent:'space-around', textAlign:'center' }}>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Year P&L</div><div style={{ fontSize:'24px', fontWeight:'800', color:yt>=0?'#3fb950':'#f85149' }}>{fmt0(yt)}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Total Trades</div><div style={{ fontSize:'24px', fontWeight:'800', color:'#e6edf3' }}>{ytr}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Active Months</div><div style={{ fontSize:'24px', fontWeight:'800', color:'#e6edf3' }}>{md.filter(m=>m.count>0).length}</div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
                {md.map(m=>(
                  <div key={m.month} onClick={()=>{ if(m.count>0){ setCursor(new Date(year,m.idx,1)); setCalLevel('month') } }}
                    style={{ ...card, padding:'16px', cursor:m.count>0?'pointer':'default', opacity:m.count>0?1:0.5, background:m.pnl>0?'rgba(63,185,80,0.06)':m.pnl<0?'rgba(248,81,73,0.06)':'#161b22', border:`1px solid ${m.pnl>0?'rgba(63,185,80,0.2)':m.pnl<0?'rgba(248,81,73,0.2)':'#21262d'}` }}>
                    <div style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3', marginBottom:'6px' }}>{m.month}</div>
                    <div style={{ fontSize:'18px', fontWeight:'800', color:m.pnl>0?'#3fb950':m.pnl<0?'#f85149':'#8b949e' }}>{m.count>0?fmt0(m.pnl):'—'}</div>
                    <div style={{ fontSize:'10px', color:'#8b949e', marginTop:'2px' }}>{m.count>0?`${m.count} trades`:'No trades'}</div>
                  </div>
                ))}
              </div>
            </>)
          })()}

          {/* MONTH */}
          {calLevel==='month' && (()=>{
            const fd=new Date(year,month,1).getDay(), dim=new Date(year,month+1,0).getDate(), off=fd===0?6:fd-1
            const cells:({day:number;date:string;pnl:number;count:number}|null)[]=[]
            for(let i=0;i<off;i++)cells.push(null)
            for(let d=1;d<=dim;d++){ const date=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; const data=dailyMap[date]; cells.push({day:d,date,pnl:data?.pnl||0,count:data?.trades.length||0}) }
            const mt=cells.reduce((s,c)=>s+(c?.pnl||0),0), mtr=cells.reduce((s,c)=>s+(c?.count||0),0), td=cells.filter(c=>c&&c.count>0).length
            return (<>
              <div style={{ ...card, marginBottom:'16px', display:'flex', justifyContent:'space-around', textAlign:'center' }}>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Month P&L</div><div style={{ fontSize:'22px', fontWeight:'800', color:mt>=0?'#3fb950':'#f85149' }}>{fmt0(mt)}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Trades</div><div style={{ fontSize:'22px', fontWeight:'800', color:'#e6edf3' }}>{mtr}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Trading Days</div><div style={{ fontSize:'22px', fontWeight:'800', color:'#e6edf3' }}>{td}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Avg/Day</div><div style={{ fontSize:'22px', fontWeight:'800', color:mt>=0?'#3fb950':'#f85149' }}>{td?fmt0(mt/td):'—'}</div></div>
              </div>
              <div style={card}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px', marginBottom:'8px' }}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>(<div key={d} style={{ textAlign:'center', fontSize:'11px', color:'#8b949e', fontWeight:'600', padding:'6px' }}>{d}</div>))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'6px' }}>
                  {cells.map((c,i)=>{
                    if(!c) return <div key={i}/>
                    const bg=c.pnl>0?'rgba(63,185,80,0.12)':c.pnl<0?'rgba(248,81,73,0.12)':'#0d1117'
                    const bd=c.pnl>0?'rgba(63,185,80,0.3)':c.pnl<0?'rgba(248,81,73,0.3)':'#21262d'
                    return (
                      <div key={i} onClick={()=>{ if(c.count>0){ setCursor(new Date(c.date+'T12:00:00')); setCalLevel('day') } }}
                        style={{ background:bg, border:`1px solid ${bd}`, borderRadius:'8px', padding:'8px', minHeight:'72px', cursor:c.count>0?'pointer':'default' }}>
                        <div style={{ fontSize:'12px', color:'#8b949e', marginBottom:'4px' }}>{c.day}</div>
                        {c.count>0 && (<>
                          <div style={{ fontSize:'12px', fontWeight:'700', color:c.pnl>=0?'#3fb950':'#f85149' }}>{fmt0(c.pnl)}</div>
                          <div style={{ fontSize:'9px', color:'#8b949e' }}>{c.count} trade{c.count>1?'s':''}</div>
                        </>)}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>)
          })()}

          {/* DAY */}
          {calLevel==='day' && (()=>{
            const ds=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}-${String(cursor.getDate()).padStart(2,'0')}`
            const data=dailyMap[ds], dt=data?.trades||[]
            const w=dt.filter(t=>(t.net_pnl||0)>0), dwr=dt.length?w.length/dt.length*100:0
            return (<>
              <div style={{ ...card, marginBottom:'16px', display:'flex', justifyContent:'space-around', textAlign:'center' }}>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Day P&L</div><div style={{ fontSize:'22px', fontWeight:'800', color:(data?.pnl||0)>=0?'#3fb950':'#f85149' }}>{data?fmt0(data.pnl):'—'}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Trades</div><div style={{ fontSize:'22px', fontWeight:'800', color:'#e6edf3' }}>{dt.length}</div></div>
                <div><div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase' }}>Win Rate</div><div style={{ fontSize:'22px', fontWeight:'800', color:dwr>=50?'#3fb950':'#e3b341' }}>{dt.length?`${dwr.toFixed(0)}%`:'—'}</div></div>
              </div>
              {dt.length===0 ? (
                <div style={{ ...card, textAlign:'center', padding:'48px', color:'#8b949e' }}>No trades on this day. Use ‹ › to browse.</div>
              ) : (
                <div style={{ ...card, padding:0, overflow:'hidden' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead><tr style={{ background:'#0d1117' }}>{['Time','Symbol','Side','Entry','Exit','Qty','Net P&L','Tags'].map(h=>(<th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'10px', color:'#8b949e', fontWeight:'600', textTransform:'uppercase', borderBottom:'1px solid #21262d', whiteSpace:'nowrap' }}>{h}</th>))}</tr></thead>
                      <tbody>
                        {dt.map((t,i)=>(
                          <tr key={i} style={{ borderBottom:'1px solid #21262d', borderLeft:`2px solid ${(t.net_pnl||0)>=0?'#3fb950':'#f85149'}` }}>
                            <td style={{ padding:'9px 14px', fontSize:'11px', color:'#8b949e' }}>{t.trade_time||'—'}</td>
                            <td style={{ padding:'9px 14px', fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{t.symbol}</td>
                            <td style={{ padding:'9px 14px' }}><span style={{ background:t.direction==='long'?'#0f3d2e':'#3d0f0f', color:t.direction==='long'?'#3fb950':'#f85149', fontSize:'10px', padding:'2px 7px', borderRadius:'4px', fontWeight:'700', textTransform:'uppercase' }}>{t.direction}</span></td>
                            <td style={{ padding:'9px 14px', fontSize:'11px', color:'#8b949e' }}>{t.entry_price?`$${Number(t.entry_price).toFixed(2)}`:'—'}</td>
                            <td style={{ padding:'9px 14px', fontSize:'11px', color:'#8b949e' }}>{t.exit_price?`$${Number(t.exit_price).toFixed(2)}`:'—'}</td>
                            <td style={{ padding:'9px 14px', fontSize:'11px', color:'#8b949e' }}>{t.quantity||'—'}</td>
                            <td style={{ padding:'9px 14px', fontSize:'12px', fontWeight:'700', color:(t.net_pnl||0)>=0?'#3fb950':'#f85149', whiteSpace:'nowrap' }}>{fmt(t.net_pnl||0)}</td>
                            <td style={{ padding:'9px 14px', fontSize:'10px', color:'#8b949e' }}>{(t.setup_tags||[]).join(', ')||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>)
          })()}
        </>
      )}
      <div style={{ height:'40px' }}/>
    </div>
  )
}
