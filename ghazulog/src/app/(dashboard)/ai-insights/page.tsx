'use client'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Rule-based analysis engine ─────────────────────────────────
function analyzeTrades(trades: any[]) {
  const closed = trades.filter(t => t.exit_price && t.net_pnl !== null)
  if (closed.length === 0) return null

  const wins   = closed.filter(t => (t.net_pnl||0) > 0)
  const losses = closed.filter(t => (t.net_pnl||0) <= 0)
  const totalPnl = closed.reduce((s,t) => s+(t.net_pnl||0), 0)
  const wr = wins.length / closed.length * 100
  const grossW = wins.reduce((s,t)=>s+(t.net_pnl||0),0)
  const grossL = Math.abs(losses.reduce((s,t)=>s+(t.net_pnl||0),0))
  const pf = grossL===0 ? grossW : grossW/grossL
  const avgW = wins.length ? grossW/wins.length : 0
  const avgL = losses.length ? grossL/losses.length : 0
  const avgRR = avgL===0 ? 0 : avgW/avgL

  // By day of week
  const dayMap: Record<number,{pnl:number;count:number;wins:number}> = {}
  closed.forEach(t => {
    const d = new Date(t.trade_date).getDay()
    if (!dayMap[d]) dayMap[d] = {pnl:0,count:0,wins:0}
    dayMap[d].pnl += t.net_pnl||0
    dayMap[d].count++
    if ((t.net_pnl||0) > 0) dayMap[d].wins++
  })
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const bestDay  = Object.entries(dayMap).sort((a,b)=>b[1].pnl-a[1].pnl)[0]
  const worstDay = Object.entries(dayMap).sort((a,b)=>a[1].pnl-b[1].pnl)[0]

  // By hour
  const hourMap: Record<number,{pnl:number;count:number;wins:number}> = {}
  closed.forEach(t => {
    const h = t.trade_time ? parseInt(t.trade_time.split(':')[0]) : new Date(t.created_at).getHours()
    if (!hourMap[h]) hourMap[h] = {pnl:0,count:0,wins:0}
    hourMap[h].pnl += t.net_pnl||0
    hourMap[h].count++
    if ((t.net_pnl||0) > 0) hourMap[h].wins++
  })
  const bestHour  = Object.entries(hourMap).sort((a,b)=>b[1].pnl-a[1].pnl)[0]
  const worstHour = Object.entries(hourMap).sort((a,b)=>a[1].pnl-b[1].pnl)[0]

  // By symbol
  const symMap: Record<string,{pnl:number;count:number;wins:number}> = {}
  closed.forEach(t => {
    const s = t.symbol||'Unknown'
    if (!symMap[s]) symMap[s] = {pnl:0,count:0,wins:0}
    symMap[s].pnl += t.net_pnl||0
    symMap[s].count++
    if ((t.net_pnl||0) > 0) symMap[s].wins++
  })
  const bestSym  = Object.entries(symMap).sort((a,b)=>b[1].pnl-a[1].pnl)[0]
  const worstSym = Object.entries(symMap).sort((a,b)=>a[1].pnl-b[1].pnl)[0]

  // By direction
  const longs  = closed.filter(t => t.direction==='long')
  const shorts = closed.filter(t => t.direction==='short')
  const longPnl  = longs.reduce((s,t)=>s+(t.net_pnl||0),0)
  const shortPnl = shorts.reduce((s,t)=>s+(t.net_pnl||0),0)
  const longWR   = longs.length  ? longs.filter(t=>(t.net_pnl||0)>0).length/longs.length*100   : 0
  const shortWR  = shorts.length ? shorts.filter(t=>(t.net_pnl||0)>0).length/shorts.length*100 : 0

  // By setup tags
  const setupMap: Record<string,{pnl:number;count:number;wins:number}> = {}
  closed.forEach(t => {
    (t.setup_tags||[]).forEach((tag: string) => {
      if (!setupMap[tag]) setupMap[tag] = {pnl:0,count:0,wins:0}
      setupMap[tag].pnl += t.net_pnl||0
      setupMap[tag].count++
      if ((t.net_pnl||0) > 0) setupMap[tag].wins++
    })
  })
  const bestSetup  = Object.entries(setupMap).sort((a,b)=>b[1].pnl-a[1].pnl)[0]
  const worstSetup = Object.entries(setupMap).sort((a,b)=>a[1].pnl-b[1].pnl)[0]

  // Mistake tags
  const mistakeMap: Record<string,{count:number;pnl:number}> = {}
  closed.forEach(t => {
    (t.mistake_tags||[]).forEach((tag: string) => {
      if (!mistakeMap[tag]) mistakeMap[tag] = {count:0,pnl:0}
      mistakeMap[tag].count++
      mistakeMap[tag].pnl += t.net_pnl||0
    })
  })
  const topMistake = Object.entries(mistakeMap).sort((a,b)=>b[1].count-a[1].count)[0]

  // Psychology: Consecutive losses (revenge trading risk)
  let maxLossStreak=0, curLoss=0, maxWinStreak=0, curWin=0
  closed.forEach(t => {
    if ((t.net_pnl||0) <= 0) { curLoss++; curWin=0; maxLossStreak=Math.max(maxLossStreak,curLoss) }
    else { curWin++; curLoss=0; maxWinStreak=Math.max(maxWinStreak,curWin) }
  })

  // Position sizing consistency
  const qtys = closed.map(t => t.quantity||1)
  const avgQty = qtys.reduce((a,b)=>a+b,0)/qtys.length
  const qtyVariance = qtys.reduce((s,q)=>s+Math.abs(q-avgQty),0)/qtys.length
  const inconsistentSizing = qtyVariance > avgQty * 0.3

  // After-loss behavior (revenge trading detection)
  let revengeTrades = 0
  for (let i=1; i<closed.length; i++) {
    if ((closed[i-1].net_pnl||0) < 0 && (closed[i].quantity||1) > avgQty * 1.5) revengeTrades++
  }

  // Max drawdown
  let peak=0, bal=0, dd=0
  closed.forEach(t => { bal+=t.net_pnl||0; if(bal>peak)peak=bal; if(peak-bal>dd)dd=peak-bal })

  // Overall score (0-100)
  let score = 50
  if (wr >= 50) score += 10; else score -= 10
  if (pf >= 1.5) score += 10; else if (pf < 1) score -= 10
  if (avgRR >= 1.5) score += 10; else if (avgRR < 1) score -= 10
  if (revengeTrades === 0) score += 10; else score -= revengeTrades * 3
  if (!inconsistentSizing) score += 5; else score -= 5
  if (maxLossStreak <= 3) score += 5; else score -= 5
  score = Math.max(0, Math.min(100, score))

  return {
    closed, wins, losses, totalPnl, wr, pf, avgRR, avgW, avgL, score,
    dayMap, bestDay, worstDay, days,
    hourMap, bestHour, worstHour,
    symMap, bestSym, worstSym,
    longs, shorts, longPnl, shortPnl, longWR, shortWR,
    setupMap, bestSetup, worstSetup,
    mistakeMap, topMistake,
    maxLossStreak, maxWinStreak,
    revengeTrades, inconsistentSizing, avgQty,
    drawdown: dd
  }
}

const fmt = (v: number) => { const a=Math.abs(v).toFixed(2); return v>=0?`+$${a}`:`-$${a}` }

export default function AIInsightsPage() {
  const supabase = createClient()

  const { canUseAI } = useSubscription()

  const [trades,    setTrades]    = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [analysis,  setAnalysis]  = useState<any>(null)
  const [geminiRes, setGeminiRes] = useState<string>('')
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [geminiError,   setGeminiError]   = useState('')
  const [activeTab, setActiveTab] = useState<'overview'|'performance'|'psychology'|'gemini'>('overview')

  useEffect(() => {
    supabase.from('trades').select('*').order('trade_date', { ascending: true }).then(({ data }) => {
      setTrades(data || [])
      if (data?.length) setAnalysis(analyzeTrades(data))
      setLoading(false)
    })
  }, [])

  async function runGeminiAnalysis() {
    setGeminiLoading(true)
    setGeminiError('')
    setGeminiRes('')
    setActiveTab('gemini')
    try {
      const a = analysis
      const summary = {
        totalTrades: a.closed.length,
        winRate: a.wr.toFixed(1)+'%',
        profitFactor: a.pf.toFixed(2),
        avgRR: a.avgRR.toFixed(2),
        totalPnl: fmt(a.totalPnl),
        maxLossStreak: a.maxLossStreak,
        revengeTrades: a.revengeTrades,
        bestDay: a.bestDay ? a.days[+a.bestDay[0]] : 'N/A',
        worstDay: a.worstDay ? a.days[+a.worstDay[0]] : 'N/A',
        bestSymbol: a.bestSym?.[0] || 'N/A',
        worstSymbol: a.worstSym?.[0] || 'N/A',
        bestSetup: a.bestSetup?.[0] || 'N/A',
        topMistake: a.topMistake?.[0] || 'N/A',
        longWR: a.longWR.toFixed(1)+'%',
        shortWR: a.shortWR.toFixed(1)+'%',
        inconsistentSizing: a.inconsistentSizing,
        overallScore: a.score+'/100'
      }

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradingData: summary })
      })
      const j = await res.json()
      if (j.error) throw new Error(j.error)
      setGeminiRes(j.analysis)
    } catch(e: any) {
      setGeminiError(e.message || 'Gemini API failed. Check your API key in .env.local')
    }
    setGeminiLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', fontFamily:'-apple-system,sans-serif' }}>
      <p style={{ color:'#8b949e' }}>Loading your trading data...</p>
    </div>
  )

  if (!analysis) return (
    <div style={{ maxWidth:'600px', fontFamily:'-apple-system,sans-serif' }}>
      <h1 style={{ fontSize:'22px', fontWeight:'600', color:'#e6edf3', margin:'0 0 8px' }}>AI Insights</h1>
      <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'48px', textAlign:'center' }}>
        <div style={{ fontSize:'40px', marginBottom:'12px' }}>🤖</div>
        <p style={{ color:'#8b949e', fontSize:'14px', margin:'0 0 16px' }}>
          No trades found yet.<br/>Add trades to your journal to get AI insights.
        </p>
        <a href="/journal" style={{ padding:'9px 20px', background:'#00d4aa', color:'#0d1117', borderRadius:'8px', fontSize:'13px', fontWeight:'600', textDecoration:'none' }}>
          → Go to Journal
        </a>
      </div>
    </div>
  )

  const a = analysis
  const scoreColor = a.score>=70?'#3fb950':a.score>=50?'#e3b341':'#f85149'
  const scoreLabel = a.score>=70?'Good Trader':'Developing Trader'

  return (
    <div style={{ maxWidth:'1100px', fontFamily:'-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'600', color:'#e6edf3', margin:'0 0 4px' }}>AI Insights</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>Deep analysis of {a.closed.length} closed trades</p>
        </div>
        <button onClick={()=>setActiveTab('gemini')}
          style={{ padding:'9px 18px', background:'linear-gradient(135deg,#4285f4,#0f9d58)', border:'none', borderRadius:'8px', color:'#fff', fontSize:'13px', fontWeight:'600', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', opacity:0.85 }}>
          ✨ Gemini Deep Analysis <span style={{ fontSize:'9px', background:'rgba(255,255,255,0.2)', padding:'2px 6px', borderRadius:'10px' }}>SOON</span>
        </button>
      </div>

      {/* Overall Score Card */}
      <div style={{ background:'#161b22', border:`1px solid ${scoreColor}33`, borderRadius:'12px', padding:'20px', marginBottom:'20px', display:'grid', gridTemplateColumns:'auto 1fr', gap:'20px', alignItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#21262d" strokeWidth="8"/>
            <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="8"
              strokeDasharray={`${(a.score/100)*264} 264`} strokeDashoffset="66" strokeLinecap="round" transform="rotate(-90 50 50)"/>
            <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill={scoreColor}>{a.score}</text>
            <text x="50" y="60" textAnchor="middle" fontSize="9" fill="#8b949e">out of 100</text>
          </svg>
          <div style={{ fontSize:'11px', fontWeight:'600', color:scoreColor, marginTop:'4px' }}>{scoreLabel}</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
          {[
            { l:'Net P&L',      v:fmt(a.totalPnl),         c: a.totalPnl>=0?'#3fb950':'#f85149' },
            { l:'Win Rate',     v:`${a.wr.toFixed(1)}%`,   c: a.wr>=50?'#3fb950':'#f85149' },
            { l:'Profit Factor',v:a.pf.toFixed(2),          c: a.pf>=1?'#3fb950':'#f85149' },
            { l:'Avg R:R',      v:`${a.avgRR.toFixed(2)}R`,c: a.avgRR>=1.5?'#3fb950':'#e3b341' },
          ].map(s => (
            <div key={s.l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:'9px', color:'#8b949e', textTransform:'uppercase', marginBottom:'4px' }}>{s.l}</div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:'0', borderBottom:'1px solid #21262d', marginBottom:'16px' }}>
        {([['overview','📊 Overview'],['performance','📈 Performance'],['psychology','🧠 Psychology'],['gemini','✨ Gemini AI']] as [string,string][]).map(([t,l]) => (
          <button key={t} onClick={()=>setActiveTab(t as any)} style={{ padding:'8px 16px', fontSize:'12px', cursor:'pointer', border:'none',
            borderBottom:`2px solid ${activeTab===t?'#00d4aa':'transparent'}`,
            background:'transparent', color: activeTab===t?'#00d4aa':'#8b949e', fontWeight: activeTab===t?'600':'400' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ─ OVERVIEW TAB ─ */}
      {activeTab==='overview' && (
        <div>
          {/* Insight cards */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>

            {/* Best day */}
            {a.bestDay && (
              <div style={{ background:'#161b22', border:'1px solid #0f3d2e', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'6px', textTransform:'uppercase' }}>🏆 Best Day</div>
                <div style={{ fontSize:'20px', fontWeight:'700', color:'#3fb950' }}>{a.days[+a.bestDay[0]]}</div>
                <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'3px' }}>{fmt(a.bestDay[1].pnl)} · {a.bestDay[1].count} trades · {(a.bestDay[1].wins/a.bestDay[1].count*100).toFixed(0)}% WR</div>
              </div>
            )}

            {/* Worst day */}
            {a.worstDay && (
              <div style={{ background:'#161b22', border:'1px solid #3d0f0f', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'6px', textTransform:'uppercase' }}>⚠️ Worst Day</div>
                <div style={{ fontSize:'20px', fontWeight:'700', color:'#f85149' }}>{a.days[+a.worstDay[0]]}</div>
                <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'3px' }}>{fmt(a.worstDay[1].pnl)} · {a.worstDay[1].count} trades</div>
              </div>
            )}

            {/* Best symbol */}
            {a.bestSym && (
              <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'6px', textTransform:'uppercase' }}>💎 Best Symbol</div>
                <div style={{ fontSize:'18px', fontWeight:'700', color:'#3fb950' }}>{a.bestSym[0]}</div>
                <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'3px' }}>{fmt(a.bestSym[1].pnl)} · {a.bestSym[1].count} trades</div>
              </div>
            )}

            {/* Long vs Short */}
            <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'8px', textTransform:'uppercase' }}>Long vs Short</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'14px', fontWeight:'700', color:'#26a69a' }}>{a.longWR.toFixed(0)}%</div>
                  <div style={{ fontSize:'9px', color:'#8b949e' }}>Long WR</div>
                  <div style={{ fontSize:'10px', color: a.longPnl>=0?'#3fb950':'#f85149' }}>{fmt(a.longPnl)}</div>
                </div>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:'14px', fontWeight:'700', color:'#ef5350' }}>{a.shortWR.toFixed(0)}%</div>
                  <div style={{ fontSize:'9px', color:'#8b949e' }}>Short WR</div>
                  <div style={{ fontSize:'10px', color: a.shortPnl>=0?'#3fb950':'#f85149' }}>{fmt(a.shortPnl)}</div>
                </div>
              </div>
            </div>

            {/* Best setup */}
            {a.bestSetup && (
              <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'6px', textTransform:'uppercase' }}>✅ Best Setup</div>
                <div style={{ fontSize:'16px', fontWeight:'700', color:'#00d4aa' }}>{a.bestSetup[0]}</div>
                <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'3px' }}>{fmt(a.bestSetup[1].pnl)} · {(a.bestSetup[1].wins/a.bestSetup[1].count*100).toFixed(0)}% WR</div>
              </div>
            )}

            {/* Top mistake */}
            {a.topMistake && (
              <div style={{ background:'#161b22', border:'1px solid #3d0f0f', borderRadius:'10px', padding:'14px' }}>
                <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'6px', textTransform:'uppercase' }}>❌ Top Mistake</div>
                <div style={{ fontSize:'16px', fontWeight:'700', color:'#f85149' }}>{a.topMistake[0]}</div>
                <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'3px' }}>{a.topMistake[1].count}x · {fmt(a.topMistake[1].pnl)}</div>
              </div>
            )}
          </div>

          {/* Auto-generated rules */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3', marginBottom:'12px' }}>📋 Auto-Generated Trading Rules</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {[
                a.wr < 50 && { type:'danger', text:`Your win rate is ${a.wr.toFixed(1)}%. Focus on trade quality over quantity — take fewer, higher-quality setups.` },
                a.pf < 1  && { type:'danger', text:`Profit factor is ${a.pf.toFixed(2)} (below 1). You're losing more than you win. Widen your TPs or tighten your SLs.` },
                a.avgRR < 1 && { type:'warning', text:`Average R:R is ${a.avgRR.toFixed(2)}. Never take a trade with less than 1:1 R:R. Aim for 1:2 minimum.` },
                a.bestDay && { type:'success', text:`You perform best on ${a.days[+a.bestDay[0]]}. Consider trading more aggressively on this day.` },
                a.worstDay && { type:'danger', text:`Avoid trading on ${a.days[+a.worstDay[0]]}. This is consistently your worst day (${fmt(a.worstDay[1].pnl)}).` },
                a.revengeTrades > 0 && { type:'warning', text:`Detected ${a.revengeTrades} possible revenge trade(s). After a loss, wait 15 minutes before next trade.` },
                a.maxLossStreak > 3 && { type:'danger', text:`Max loss streak: ${a.maxLossStreak}. Add a rule: stop trading after 3 consecutive losses in a day.` },
                a.inconsistentSizing && { type:'warning', text:`Inconsistent position sizing detected. Use the same lot size on every trade to protect your account.` },
                a.longWR > a.shortWR + 15 && { type:'success', text:`You're much better at longs (${a.longWR.toFixed(0)}% WR) than shorts (${a.shortWR.toFixed(0)}% WR). Focus on long setups.` },
                a.shortWR > a.longWR + 15 && { type:'success', text:`You're much better at shorts (${a.shortWR.toFixed(0)}% WR) than longs (${a.longWR.toFixed(0)}% WR). Focus on short setups.` },
                a.bestSetup && { type:'success', text:`Your ${a.bestSetup[0]} setup has ${(a.bestSetup[1].wins/a.bestSetup[1].count*100).toFixed(0)}% WR. This is your edge — trade it more.` },
                a.worstSetup && a.worstSetup[1].pnl < 0 && { type:'danger', text:`Your ${a.worstSetup[0]} setup is consistently losing (${fmt(a.worstSetup[1].pnl)}). Stop using it until you understand why.` },
              ].filter(Boolean).map((rule: any, i: number) => (
                <div key={i} style={{ display:'flex', gap:'10px', padding:'10px 12px', borderRadius:'8px', background: rule.type==='danger'?'rgba(248,81,73,0.08)':rule.type==='warning'?'rgba(227,179,65,0.08)':'rgba(63,185,80,0.08)', border:`1px solid ${rule.type==='danger'?'rgba(248,81,73,0.2)':rule.type==='warning'?'rgba(227,179,65,0.2)':'rgba(63,185,80,0.2)'}` }}>
                  <span style={{ fontSize:'14px', flexShrink:0 }}>{rule.type==='danger'?'🔴':rule.type==='warning'?'🟡':'🟢'}</span>
                  <span style={{ fontSize:'12px', color:'#e6edf3', lineHeight:'1.5' }}>{rule.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─ PERFORMANCE TAB ─ */}
      {activeTab==='performance' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>

          {/* P&L by day heatmap */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'12px' }}>P&L by Day of Week</div>
            <div style={{ display:'flex', gap:'6px' }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i) => {
                const s = a.dayMap[i]||{pnl:0,count:0,wins:0}
                const max = Math.max(...Object.values(a.dayMap).map((x:any)=>Math.abs(x.pnl)),1)
                const int = Math.abs(s.pnl)/max
                return (
                  <div key={d} style={{ flex:1, textAlign:'center' }}>
                    <div style={{ borderRadius:'6px', padding:'8px 2px', marginBottom:'4px',
                      background: s.pnl>0?`rgba(63,185,80,${0.15+int*0.65})`:s.pnl<0?`rgba(248,81,73,${0.15+int*0.65})`:'#21262d' }}>
                      <div style={{ fontSize:'10px', fontWeight:'600', color: s.pnl>0?'#3fb950':s.pnl<0?'#f85149':'#8b949e' }}>{s.pnl!==0?(s.pnl>0?'+':'')+s.pnl.toFixed(0):'—'}</div>
                      <div style={{ fontSize:'8px', color:'#8b949e' }}>{s.count||''}</div>
                    </div>
                    <div style={{ fontSize:'9px', color:'#8b949e' }}>{d}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* P&L by hour */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'12px' }}>P&L by Hour</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:'2px' }}>
              {Array.from({length:24},(_,h) => {
                const s = a.hourMap[h]||{pnl:0,count:0}
                const max = Math.max(...Object.values(a.hourMap).map((x:any)=>Math.abs(x.pnl)),1)
                const int = Math.abs(s.pnl)/max
                return (
                  <div key={h} title={`${h}:00 · ${s.count} trades · ${fmt(s.pnl)}`}
                    style={{ borderRadius:'3px', padding:'4px 0', textAlign:'center', cursor:'default',
                      background: s.pnl>0?`rgba(63,185,80,${0.2+int*0.65})`:s.pnl<0?`rgba(248,81,73,${0.2+int*0.65})`:'#21262d' }}>
                    <div style={{ fontSize:'7px', color:'#8b949e' }}>{h}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:'flex', gap:'8px', marginTop:'6px', fontSize:'9px', color:'#8b949e' }}>
              <span style={{ color:'#3fb950' }}>■ Profitable</span>
              <span style={{ color:'#f85149' }}>■ Losing</span>
            </div>
          </div>

          {/* Symbol performance */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'12px' }}>Performance by Symbol</div>
            {Object.entries(a.symMap).sort((a:any,b:any)=>b[1].pnl-a[1].pnl).slice(0,8).map(([sym,s]:any) => (
              <div key={sym} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                <span style={{ fontSize:'11px', color:'#e6edf3', width:'80px', flexShrink:0, fontWeight:'500' }}>{sym}</span>
                <div style={{ flex:1, height:'8px', background:'#21262d', borderRadius:'4px', overflow:'hidden' }}>
                  <div style={{ width:`${Math.abs(s.pnl)/Math.max(...Object.values(a.symMap).map((x:any)=>Math.abs(x.pnl)),1)*100}%`, height:'100%', background: s.pnl>=0?'#3fb950':'#f85149', borderRadius:'4px' }}/>
                </div>
                <span style={{ fontSize:'10px', color: s.pnl>=0?'#3fb950':'#f85149', width:'56px', textAlign:'right' }}>{fmt(s.pnl)}</span>
                <span style={{ fontSize:'9px', color:'#8b949e', width:'30px', textAlign:'right' }}>{(s.wins/s.count*100).toFixed(0)}%</span>
              </div>
            ))}
          </div>

          {/* Setup performance */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'12px' }}>Setup Win Rates</div>
            {Object.keys(a.setupMap).length === 0 ? (
              <div style={{ color:'#8b949e', fontSize:'12px' }}>No setup tags found. Tag your trades to see setup performance.</div>
            ) : Object.entries(a.setupMap).sort((a:any,b:any)=>b[1].wins/b[1].count-a[1].wins/a[1].count).map(([tag,s]:any) => {
              const wr2 = s.wins/s.count*100
              return (
                <div key={tag} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                  <span style={{ fontSize:'11px', color:'#e6edf3', width:'100px', flexShrink:0 }}>{tag}</span>
                  <div style={{ flex:1, height:'8px', background:'#21262d', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${wr2}%`, height:'100%', background: wr2>=60?'#3fb950':wr2>=40?'#e3b341':'#f85149', borderRadius:'4px' }}/>
                  </div>
                  <span style={{ fontSize:'10px', color: wr2>=60?'#3fb950':wr2>=40?'#e3b341':'#f85149', width:'36px', textAlign:'right' }}>{wr2.toFixed(0)}%</span>
                  <span style={{ fontSize:'9px', color:'#8b949e', width:'24px', textAlign:'right' }}>{s.count}t</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─ PSYCHOLOGY TAB ─ */}
      {activeTab==='psychology' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>

          {/* Streak analysis */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'14px' }}>Streak Analysis</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
              <div style={{ background:'#0f3d2e', borderRadius:'8px', padding:'12px', textAlign:'center' }}>
                <div style={{ fontSize:'28px', fontWeight:'700', color:'#3fb950' }}>{a.maxWinStreak}</div>
                <div style={{ fontSize:'10px', color:'#8b949e', marginTop:'3px' }}>Max Win Streak</div>
              </div>
              <div style={{ background: a.maxLossStreak>3?'#3d0f0f':'#161b22', borderRadius:'8px', padding:'12px', textAlign:'center', border: a.maxLossStreak>3?'1px solid #f85149':'1px solid #21262d' }}>
                <div style={{ fontSize:'28px', fontWeight:'700', color: a.maxLossStreak>3?'#f85149':'#e6edf3' }}>{a.maxLossStreak}</div>
                <div style={{ fontSize:'10px', color:'#8b949e', marginTop:'3px' }}>Max Loss Streak</div>
              </div>
            </div>
            {a.maxLossStreak > 3 && (
              <div style={{ background:'rgba(248,81,73,0.08)', border:'1px solid rgba(248,81,73,0.2)', borderRadius:'8px', padding:'10px', fontSize:'12px', color:'#e6edf3', lineHeight:'1.5' }}>
                🔴 <strong>Risk:</strong> A {a.maxLossStreak}-trade losing streak is dangerous. Add a rule: <strong>stop trading after 3 losses in a day</strong> and review your plan.
              </div>
            )}
          </div>

          {/* Revenge trading */}
          <div style={{ background:'#161b22', border:`1px solid ${a.revengeTrades>0?'rgba(248,81,73,0.3)':'#21262d'}`, borderRadius:'10px', padding:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'14px' }}>Revenge Trading Detection</div>
            <div style={{ textAlign:'center', marginBottom:'14px' }}>
              <div style={{ fontSize:'36px', fontWeight:'700', color: a.revengeTrades>0?'#f85149':'#3fb950' }}>{a.revengeTrades}</div>
              <div style={{ fontSize:'11px', color:'#8b949e' }}>Suspected Revenge Trades</div>
              <div style={{ fontSize:'10px', color:'#8b949e', marginTop:'3px' }}>(Oversized trade after a loss)</div>
            </div>
            <div style={{ background: a.revengeTrades>0?'rgba(248,81,73,0.08)':'rgba(63,185,80,0.08)', borderRadius:'8px', padding:'10px', fontSize:'12px', color:'#e6edf3', lineHeight:'1.5', border:`1px solid ${a.revengeTrades>0?'rgba(248,81,73,0.2)':'rgba(63,185,80,0.2)'}` }}>
              {a.revengeTrades>0
                ? `🔴 You traded ${a.revengeTrades}x with larger size after a loss. This is the #1 account killer. Always use the same position size.`
                : '🟢 No revenge trading detected! Great discipline with position sizing.'}
            </div>
          </div>

          {/* Position sizing */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'14px' }}>Position Sizing Consistency</div>
            <div style={{ textAlign:'center', marginBottom:'14px' }}>
              <div style={{ fontSize:'24px', fontWeight:'700', color: a.inconsistentSizing?'#e3b341':'#3fb950' }}>
                {a.inconsistentSizing ? '⚠️ Inconsistent' : '✅ Consistent'}
              </div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'4px' }}>Avg size: {a.avgQty.toFixed(2)} lots</div>
            </div>
            <div style={{ background: a.inconsistentSizing?'rgba(227,179,65,0.08)':'rgba(63,185,80,0.08)', borderRadius:'8px', padding:'10px', fontSize:'12px', color:'#e6edf3', lineHeight:'1.5', border:`1px solid ${a.inconsistentSizing?'rgba(227,179,65,0.2)':'rgba(63,185,80,0.2)'}` }}>
              {a.inconsistentSizing
                ? '🟡 Inconsistent position sizing hurts your risk management. Set a fixed lot size based on 1-2% account risk per trade.'
                : '🟢 Your position sizing is consistent. Keep it up!'}
            </div>
          </div>

          {/* Mistake frequency */}
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px' }}>
            <div style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'14px' }}>Mistake Frequency</div>
            {Object.keys(a.mistakeMap).length === 0 ? (
              <div style={{ color:'#8b949e', fontSize:'12px' }}>No mistake tags found. Tag your mistakes when journaling to track patterns.</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {Object.entries(a.mistakeMap).sort((a:any,b:any)=>b[1].count-a[1].count).map(([tag,s]:any) => (
                  <div key={tag}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
                      <span style={{ fontSize:'11px', color:'#e6edf3' }}>{tag}</span>
                      <span style={{ fontSize:'10px', color:'#f85149' }}>{s.count}x · {fmt(s.pnl)}</span>
                    </div>
                    <div style={{ height:'6px', background:'#21262d', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${s.count/Math.max(...Object.values(a.mistakeMap).map((x:any)=>x.count))*100}%`, height:'100%', background:'#f85149', borderRadius:'3px' }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─ GEMINI TAB ─ */}
      {activeTab==='gemini' && (
        <div>
          <div style={{ background:'linear-gradient(135deg,rgba(66,133,244,0.08),rgba(15,157,88,0.08),#161b22)', border:'1px solid rgba(66,133,244,0.3)', borderRadius:'14px', padding:'56px 32px', textAlign:'center' }}>
            <div style={{ fontSize:'52px', marginBottom:'16px' }}>✨</div>
            <div style={{ display:'inline-block', background:'rgba(66,133,244,0.15)', border:'1px solid rgba(66,133,244,0.3)', borderRadius:'50px', padding:'5px 16px', fontSize:'11px', color:'#4285f4', fontWeight:'700', letterSpacing:'1px', marginBottom:'16px', textTransform:'uppercase' }}>
              🚀 Coming Soon
            </div>
            <div style={{ fontSize:'22px', fontWeight:'800', color:'#e6edf3', marginBottom:'10px' }}>Gemini AI Deep Analysis</div>
            <p style={{ color:'#8b949e', fontSize:'14px', maxWidth:'440px', margin:'0 auto 24px', lineHeight:'1.7' }}>
              We're putting the finishing touches on AI-powered deep analysis. Soon, Google Gemini will analyze your trading patterns and give you personalized coaching, psychology insights, and actionable strategies to improve your edge.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', maxWidth:'500px', margin:'0 auto 24px' }}>
              {[
                { icon:'🧠', title:'Pattern Detection', desc:'Spot hidden habits' },
                { icon:'🎯', title:'Custom Coaching', desc:'Tailored to you' },
                { icon:'📈', title:'Action Plans', desc:'Concrete next steps' },
              ].map(f => (
                <div key={f.title} style={{ background:'rgba(255,255,255,0.02)', border:'1px solid #21262d', borderRadius:'10px', padding:'16px 12px' }}>
                  <div style={{ fontSize:'24px', marginBottom:'8px' }}>{f.icon}</div>
                  <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', marginBottom:'2px' }}>{f.title}</div>
                  <div style={{ fontSize:'10px', color:'#8b949e' }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:'12px', color:'#8b949e' }}>
              In the meantime, check out the <span style={{ color:'#00d4aa', cursor:'pointer', fontWeight:'600' }} onClick={()=>setActiveTab('overview')}>Overview</span>, <span style={{ color:'#00d4aa', cursor:'pointer', fontWeight:'600' }} onClick={()=>setActiveTab('performance')}>Performance</span>, and <span style={{ color:'#00d4aa', cursor:'pointer', fontWeight:'600' }} onClick={()=>setActiveTab('psychology')}>Psychology</span> tabs — fully working now!
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
