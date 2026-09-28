'use client'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'
import { useEffect, useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function sharpe(pnls:number[]){if(pnls.length<2)return 0;const m=pnls.reduce((a,b)=>a+b,0)/pnls.length;const s=Math.sqrt(pnls.reduce((a,b)=>a+(b-m)**2,0)/pnls.length);return s===0?0:(m/s)*Math.sqrt(252)}
function maxDD(pnls:number[]){let peak=0,bal=0,dd=0;pnls.forEach(p=>{bal+=p;if(bal>peak)peak=bal;if(peak-bal>dd)dd=peak-bal});return dd}
const fmt=(v:number)=>{const a=Math.abs(v).toFixed(2);return v>=0?`+$${a}`:`-$${a}`}

const SYMBOLS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','AAPL','TSLA','NVDA','SPY','QQQ','MSFT','AMD','EUR/USD','GBP/USD']
const TIMEFRAMES=['1m','3m','5m','15m','30m','1h','2h','4h','6h','12h','1D','1W']
const STRATEGY_PRESETS=['Breakout','Reversal','Trend Follow','Range','Support/Resistance','EMA Cross','Order Block','Liquidity Grab']
const TAG_PRESETS=['Clean setup','High volume','News driven','Counter-trend','Confluence','FVG','Retest','A+ setup']

export default function SessionsDashboard(){
  const supabase=createClient()
  const router=useRouter()
  const [sessions,  setSessions]  =useState<any[]>([])
  const [trades,    setTrades]    =useState<any[]>([])
  const [selected,  setSelected]  =useState<string|null>(null)
  const [loading,   setLoading]   =useState(true)
  const [creating,  setCreating]  =useState(false)
  const [saving,    setSaving]    =useState(false)
  const [error,     setError]     =useState('')
  const [expanded,  setExpanded]  =useState<string|null>(null)
  const [form,      setForm]      =useState({name:'',symbol:'BTCUSDT',timeframe:'4h',strategy:'',tags:[] as string[],notes:'',starting_capital:'10000'})
  const [tagInput,  setTagInput]  =useState('')

  useEffect(()=>{load()},[])

  async function load(){
    setLoading(true)
    try{
      const{data:s,error:se}=await supabase.from('backtest_sessions').select('*').order('created_at',{ascending:false})
      if(se)console.error('Sessions error:',se)
      const{data:t,error:te}=await supabase.from('backtest_trades').select('*').not('session_id','is',null).order('trade_date')
      if(te)console.error('Trades error:',te)
      setSessions(s||[])
      setTrades(t||[])
      if(s?.length)setSelected(s[0].id)
    }catch(e){
      console.error('Load error:',e)
      setError('Failed to load. Check console.')
    }
    setLoading(false)
  }

  // distinct previously-used tags + strategies for quick-pick chips
  const usedStrategies=Array.from(new Set([...sessions.map(s=>s.strategy),...trades.map(t=>t.strategy)].filter(Boolean)))
  const usedTags=Array.from(new Set(trades.flatMap(t=>(t.setup_tags||'').split(',')).map((x:string)=>x.trim()).filter(Boolean)))
  const tagChoices=Array.from(new Set([...usedTags,...TAG_PRESETS]))
  const stratChoices=Array.from(new Set([...usedStrategies,...STRATEGY_PRESETS]))

  function toggleTag(tag:string){
    setForm(p=>({...p,tags:p.tags.includes(tag)?p.tags.filter(x=>x!==tag):[...p.tags,tag]}))
  }
  function addCustomTag(){
    const t=tagInput.trim()
    if(t&&!form.tags.includes(t))setForm(p=>({...p,tags:[...p.tags,t]}))
    setTagInput('')
  }

  async function createSession(){
    if(saving)return
    setSaving(true); setError('')
    try{
      const{data:{user},error:ue}=await supabase.auth.getUser()
      if(ue||!user){setError('Not logged in. Please refresh.');setSaving(false);return}

      const payload:any={
        user_id:    user.id,
        name:       form.name||`${form.strategy||'Session'} · ${form.symbol}`,
        symbol:     form.symbol,
        timeframe:  form.timeframe,
        strategy:   form.strategy||null,
        notes:      [form.notes,form.tags.length?`Tags: ${form.tags.join(', ')}`:''].filter(Boolean).join(' | ')||null,
        total_trades:0,
        win_rate:   0,
        total_pnl:  0,
      }
      try{payload.starting_capital=parseFloat(form.starting_capital)||10000}catch{}

      const{data,error:ie}=await supabase.from('backtest_sessions').insert(payload).select().single()
      if(ie){console.error('Insert error:',ie);setError(`Error: ${ie.message}`);setSaving(false);return}
      if(!data){setError('No data returned');setSaving(false);return}

      setSessions(prev=>[data,...prev])
      setSelected(data.id)
      setSaving(false)
      router.push(`/backtest/${data.id}`)
    }catch(e:any){
      console.error('Create error:',e)
      setError(`Unexpected error: ${e?.message||e}`)
      setSaving(false)
    }
  }

  async function deleteSession(id:string){
    if(!confirm('Delete this session and all its trades?'))return
    await supabase.from('backtest_trades').delete().eq('session_id',id)
    await supabase.from('backtest_sessions').delete().eq('id',id)
    setSessions(prev=>prev.filter(s=>s.id!==id))
    setTrades(prev=>prev.filter(t=>t.session_id!==id))
    if(selected===id){
      const remaining=sessions.filter(s=>s.id!==id)
      setSelected(remaining[0]?.id||null)
    }
  }

  const selTrades  =trades.filter(t=>t.session_id===selected)
  const closed     =selTrades.filter(t=>t.exit_price)
  const wins       =closed.filter(t=>(t.net_pnl||0)>0)
  const losses     =closed.filter(t=>(t.net_pnl||0)<=0)
  const totalPnl   =closed.reduce((s,t)=>s+(t.net_pnl||0),0)
  const grossW     =wins.reduce((s,t)=>s+(t.net_pnl||0),0)
  const grossL     =Math.abs(losses.reduce((s,t)=>s+(t.net_pnl||0),0))
  const wr         =closed.length?wins.length/closed.length*100:0
  const pf         =grossL===0?grossW:grossW/grossL
  const avgW       =wins.length?grossW/wins.length:0
  const avgL       =losses.length?grossL/losses.length:0
  const avgRR      =avgL===0?0:avgW/avgL
  const sh         =sharpe(closed.map(t=>t.net_pnl||0))
  const mdd        =maxDD(closed.map(t=>t.net_pnl||0))
  const best       =closed.length?Math.max(...closed.map(t=>t.net_pnl||0)):0
  const worst      =closed.length?Math.min(...closed.map(t=>t.net_pnl||0)):0
  const startBal   =parseFloat(sessions.find(s=>s.id===selected)?.starting_capital||'10000')||10000
  let runBal       =startBal
  const equity     =closed.map(t=>{runBal+=t.net_pnl||0;return runBal})
  const hourMap:Record<number,{pnl:number;count:number}>={}
  const dayMap :Record<number,{pnl:number;count:number}>={}
  closed.forEach(t=>{
    const d=new Date(t.trade_date);const h=d.getHours(),dow=d.getDay()
    if(!hourMap[h])hourMap[h]={pnl:0,count:0};hourMap[h].pnl+=t.net_pnl||0;hourMap[h].count++
    if(!dayMap[dow])dayMap[dow]={pnl:0,count:0};dayMap[dow].pnl+=t.net_pnl||0;dayMap[dow].count++
  })

  const inp=(ex?:any)=>({style:{width:'100%',padding:'7px 10px',background:'#0d1117',border:'1px solid #21262d',borderRadius:'6px',color:'#e6edf3',fontSize:'13px',outline:'none',boxSizing:'border-box' as const,...ex}})
  const selSession=sessions.find(s=>s.id===selected)

  if(loading)return(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',fontFamily:'-apple-system,sans-serif'}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:'32px',height:'32px',background:'#00d4aa',borderRadius:'8px',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:'700',color:'#0d1117'}}>G</div>
        <p style={{color:'#8b949e',fontSize:'13px'}}>Loading sessions...</p>
      </div>
    </div>
  )

  return(
    <div style={{maxWidth:'1300px',fontFamily:'-apple-system,sans-serif'}}>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'600',color:'#e6edf3',margin:'0 0 3px'}}>Backtest Sessions</h1>
          <p style={{color:'#8b949e',fontSize:'13px',margin:0}}>{sessions.length} sessions · {trades.length} total trades</p>
        </div>
        <button onClick={()=>{setCreating(!creating);setError('')}}
          style={{padding:'8px 18px',background:creating?'transparent':'#00d4aa',border:creating?'1px solid #30363d':'none',borderRadius:'8px',color:creating?'#8b949e':'#0d1117',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
          {creating?'✕ Cancel':'+ New Session'}
        </button>
      </div>

      {error&&(
        <div style={{background:'#3d0f0f',border:'1px solid #f85149',borderRadius:'8px',padding:'10px 14px',marginBottom:'16px',color:'#f85149',fontSize:'13px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>⚠️ {error}</span>
          <button onClick={()=>setError('')} style={{background:'none',border:'none',color:'#f85149',cursor:'pointer',fontSize:'16px'}}>✕</button>
        </div>
      )}

      {creating&&(
        <div style={{background:'#161b22',border:'1px solid #00d4aa',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
          <div style={{fontSize:'15px',fontWeight:'600',color:'#e6edf3',marginBottom:'14px'}}>🚀 New Backtest Session</div>

          {/* Strategy name — prominent on top */}
          <div style={{marginBottom:'14px'}}>
            <label style={{fontSize:'11px',color:'#00d4aa',display:'block',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Strategy Name</label>
            <input value={form.strategy} onChange={e=>setForm(p=>({...p,strategy:e.target.value}))} placeholder="Name this strategy (e.g. London Breakout)"
              style={{width:'100%',padding:'10px 12px',background:'#0d1117',border:'1px solid #00d4aa',borderRadius:'8px',color:'#e6edf3',fontSize:'15px',fontWeight:'600',outline:'none',boxSizing:'border-box'}}/>
            {stratChoices.length>0&&(
              <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginTop:'8px'}}>
                {stratChoices.slice(0,10).map(st=>(
                  <button key={st} onClick={()=>setForm(p=>({...p,strategy:st}))}
                    style={{padding:'3px 10px',background:form.strategy===st?'#00d4aa':'#0d1117',border:`1px solid ${form.strategy===st?'#00d4aa':'#30363d'}`,borderRadius:'12px',color:form.strategy===st?'#0d1117':'#8b949e',fontSize:'11px',cursor:'pointer'}}>
                    {st}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Setup tags — quick pick */}
          <div style={{marginBottom:'14px'}}>
            <label style={{fontSize:'11px',color:'#8b949e',display:'block',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Setup Tags</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:'8px'}}>
              {tagChoices.slice(0,14).map(tag=>(
                <button key={tag} onClick={()=>toggleTag(tag)}
                  style={{padding:'4px 11px',background:form.tags.includes(tag)?'#0a2d26':'#0d1117',border:`1px solid ${form.tags.includes(tag)?'#00d4aa':'#30363d'}`,borderRadius:'14px',color:form.tags.includes(tag)?'#00d4aa':'#8b949e',fontSize:'11px',cursor:'pointer'}}>
                  {form.tags.includes(tag)?'✓ ':''}{tag}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addCustomTag()}}}
                placeholder="+ add custom tag" {...inp({fontSize:'12px',padding:'5px 9px'})}/>
              <button onClick={addCustomTag} style={{padding:'5px 14px',background:'#21262d',border:'none',borderRadius:'6px',color:'#e6edf3',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>Add</button>
            </div>
          </div>

          {/* Symbol / TF / Capital / Name */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'12px',marginBottom:'16px'}}>
            <div>
              <label style={{fontSize:'11px',color:'#8b949e',display:'block',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Symbol</label>
              <select value={form.symbol} onChange={e=>setForm(p=>({...p,symbol:e.target.value}))}
                style={{width:'100%',padding:'7px 10px',background:'#0d1117',border:'1px solid #21262d',borderRadius:'6px',color:'#e6edf3',fontSize:'13px',outline:'none'}}>
                {SYMBOLS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:'11px',color:'#8b949e',display:'block',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Timeframe</label>
              <select value={form.timeframe} onChange={e=>setForm(p=>({...p,timeframe:e.target.value}))}
                style={{width:'100%',padding:'7px 10px',background:'#0d1117',border:'1px solid #21262d',borderRadius:'6px',color:'#e6edf3',fontSize:'13px',outline:'none'}}>
                {TIMEFRAMES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:'11px',color:'#8b949e',display:'block',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Starting Capital ($)</label>
              <input type="number" value={form.starting_capital} onChange={e=>setForm(p=>({...p,starting_capital:e.target.value}))} placeholder="10000" {...inp()}/>
            </div>
            <div>
              <label style={{fontSize:'11px',color:'#8b949e',display:'block',marginBottom:'4px',textTransform:'uppercase',letterSpacing:'0.5px'}}>Notes (optional)</label>
              <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. EMA 50/200" {...inp()}/>
            </div>
          </div>

          <button onClick={createSession} disabled={saving}
            style={{padding:'10px 28px',background:saving?'#0a8a6e':'#00d4aa',border:'none',borderRadius:'8px',color:'#0d1117',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Creating...':'🚀 Create & Open Session'}
          </button>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:'16px'}}>

        {/* Sessions list */}
        <div>
          <div style={{fontSize:'10px',color:'#8b949e',marginBottom:'8px',textTransform:'uppercase',letterSpacing:'1px'}}>All Sessions</div>
          {sessions.length===0?(
            <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'32px',textAlign:'center'}}>
              <div style={{fontSize:'32px',marginBottom:'10px'}}>🔬</div>
              <p style={{color:'#8b949e',fontSize:'13px',margin:'0 0 14px'}}>No sessions yet</p>
              <button onClick={()=>setCreating(true)}
                style={{padding:'7px 16px',background:'#00d4aa',border:'none',borderRadius:'7px',color:'#0d1117',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>
                Create First Session
              </button>
            </div>
          ):(
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {sessions.map(s=>{
                const st=trades.filter(t=>t.session_id===s.id)
                const sw=st.filter(t=>(t.net_pnl||0)>0)
                const wr2=st.length?(sw.length/st.length*100).toFixed(0):'0'
                const pnl=st.reduce((a,t)=>a+(t.net_pnl||0),0)
                const isSel=selected===s.id
                return(
                  <div key={s.id} onClick={()=>setSelected(s.id)}
                    style={{background:isSel?'#0a2d26':'#161b22',border:`1px solid ${isSel?'#00d4aa':'#21262d'}`,borderRadius:'10px',padding:'12px 14px',cursor:'pointer',transition:'all 0.15s'}}>
                    {s.strategy&&<div style={{fontSize:'12px',fontWeight:'700',color:'#00d4aa',marginBottom:'4px'}}>{s.strategy}</div>}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                      <div>
                        <div style={{fontSize:'15px',fontWeight:'600',color:'#e6edf3'}}>{s.symbol}</div>
                        <div style={{fontSize:'10px',color:'#8b949e',marginTop:'1px'}}>{s.timeframe} · {new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{display:'flex',gap:'4px'}}>
                        <button onClick={e=>{e.stopPropagation();router.push(`/backtest/${s.id}`)}}
                          style={{padding:'3px 10px',background:'#00d4aa',border:'none',borderRadius:'5px',color:'#0d1117',fontSize:'10px',fontWeight:'700',cursor:'pointer'}}>Open</button>
                        <button onClick={e=>{e.stopPropagation();deleteSession(s.id)}}
                          style={{padding:'3px 7px',background:'transparent',border:'1px solid #f85149',borderRadius:'5px',color:'#f85149',cursor:'pointer',fontSize:'10px'}}>🗑</button>
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'10px',fontSize:'11px'}}>
                      <span style={{color:'#8b949e'}}>{st.length} trades</span>
                      <span style={{color:pnl>=0?'#3fb950':'#f85149',fontWeight:'600'}}>{fmt(pnl)}</span>
                      <span style={{color:+wr2>=50?'#3fb950':'#f85149'}}>WR: {wr2}%</span>
                    </div>
                    {s.notes&&<div style={{fontSize:'10px',color:'#8b949e',marginTop:'4px',fontStyle:'italic'}}>{s.notes}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Report */}
        {selected?(
          <div>
            {/* Session strategy header */}
            {selSession?.strategy&&(
              <div style={{background:'#0a2d26',border:'1px solid #00d4aa',borderRadius:'10px',padding:'12px 16px',marginBottom:'12px'}}>
                <div style={{fontSize:'10px',color:'#00d4aa',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'2px'}}>Strategy</div>
                <div style={{fontSize:'18px',fontWeight:'700',color:'#e6edf3'}}>{selSession.strategy}</div>
              </div>
            )}
            {closed.length===0?(
              <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'48px',textAlign:'center'}}>
                <div style={{fontSize:'36px',marginBottom:'12px'}}>📊</div>
                <p style={{color:'#8b949e',fontSize:'14px',margin:'0 0 16px'}}>No closed trades in this session yet.<br/>Open the session and start backtesting!</p>
                <button onClick={()=>router.push(`/backtest/${selected}`)}
                  style={{padding:'9px 20px',background:'#00d4aa',color:'#0d1117',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
                  Open Session & Start Backtesting →
                </button>
              </div>
            ):(<>

              {/* Stats */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px',marginBottom:'12px'}}>
                {[
                  {l:'Net P&L',      v:fmt(totalPnl),          c:totalPnl>=0?'#3fb950':'#f85149',bg:totalPnl>=0?'#0f3d2e':'#3d0f0f'},
                  {l:'Win Rate',     v:`${wr.toFixed(1)}%`,    c:wr>=50?'#3fb950':'#f85149',      bg:'#161b22'},
                  {l:'Profit Factor',v:pf.toFixed(2),           c:pf>=1?'#3fb950':'#f85149',       bg:'#161b22'},
                  {l:'Sharpe Ratio', v:sh.toFixed(2),           c:sh>=1?'#3fb950':sh>=0?'#e3b341':'#f85149',bg:'#161b22'},
                  {l:'Max Drawdown', v:`-$${mdd.toFixed(2)}`,  c:'#f85149',                        bg:'#3d0f0f'},
                  {l:'Avg R:R',      v:`${avgRR.toFixed(2)}R`, c:avgRR>=1.5?'#3fb950':'#e3b341',  bg:'#161b22'},
                  {l:'Best Trade',   v:fmt(best),               c:'#3fb950',                        bg:'#0f3d2e'},
                  {l:'Worst Trade',  v:fmt(worst),              c:'#f85149',                        bg:'#3d0f0f'},
                ].map(s=>(
                  <div key={s.l} style={{background:s.bg,border:'1px solid #21262d',borderRadius:'8px',padding:'10px 12px'}}>
                    <div style={{fontSize:'9px',color:'#8b949e',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>{s.l}</div>
                    <div style={{fontSize:'16px',fontWeight:'600',color:s.c}}>{s.v}</div>
                  </div>
                ))}
              </div>

              {/* Equity curve + donut */}
              <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:'10px',marginBottom:'12px'}}>
                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'14px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#e6edf3',marginBottom:'10px',display:'flex',justifyContent:'space-between'}}>
                    <span>Equity Curve</span>
                    <span style={{color:totalPnl>=0?'#3fb950':'#f85149'}}>{fmt(totalPnl)}</span>
                  </div>
                  {equity.length>1&&(()=>{
                    const W=400,H=120,mn=Math.min(startBal,...equity),mx=Math.max(startBal,...equity),rng=mx-mn||1
                    const pts=equity.map((v,i)=>`${(i/(equity.length-1))*W},${H-(v-mn)/rng*H}`)
                    const zeroY=H-(startBal-mn)/rng*H
                    return(
                      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{overflow:'visible'}}>
                        <defs>
                          <linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={totalPnl>=0?'#00d4aa':'#f85149'} stopOpacity="0.3"/>
                            <stop offset="100%" stopColor={totalPnl>=0?'#00d4aa':'#f85149'} stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <polygon points={`${pts.join(' ')} ${W},${H} 0,${H}`} fill="url(#eqg)"/>
                        <polyline points={pts.join(' ')} fill="none" stroke={totalPnl>=0?'#00d4aa':'#f85149'} strokeWidth="2"/>
                        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#30363d" strokeWidth="0.5" strokeDasharray="4,4"/>
                      </svg>
                    )
                  })()}
                </div>
                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'14px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'10px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#e6edf3'}}>Win / Loss</div>
                  <svg width="90" height="90" viewBox="0 0 90 90">
                    <circle cx="45" cy="45" r="36" fill="none" stroke="#21262d" strokeWidth="10"/>
                    <circle cx="45" cy="45" r="36" fill="none" stroke="#26a69a" strokeWidth="10"
                      strokeDasharray={`${(wr/100)*226} 226`} strokeDashoffset="56" strokeLinecap="round" transform="rotate(-90 45 45)"/>
                    <text x="45" y="49" textAnchor="middle" fontSize="14" fontWeight="600" fill="#e6edf3">{wr.toFixed(0)}%</text>
                  </svg>
                  <div style={{display:'flex',gap:'16px',fontSize:'11px'}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:'15px',fontWeight:'600',color:'#26a69a'}}>{wins.length}</div><div style={{color:'#8b949e'}}>Wins</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:'15px',fontWeight:'600',color:'#ef5350'}}>{losses.length}</div><div style={{color:'#8b949e'}}>Losses</div></div>
                  </div>
                </div>
              </div>

              {/* Heatmaps */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'14px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#e6edf3',marginBottom:'10px'}}>P&L by Day of Week</div>
                  <div style={{display:'flex',gap:'5px'}}>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>{
                      const s=dayMap[i]||{pnl:0,count:0}
                      const max=Math.max(...Object.values(dayMap).map(x=>Math.abs(x.pnl)),1)
                      const int=Math.abs(s.pnl)/max
                      return(
                        <div key={d} style={{flex:1,textAlign:'center'}}>
                          <div style={{borderRadius:'5px',padding:'7px 2px',marginBottom:'3px',
                            background:s.pnl>0?`rgba(38,166,154,${0.15+int*0.65})`:s.pnl<0?`rgba(239,83,80,${0.15+int*0.65})`:'#21262d'}}>
                            <div style={{fontSize:'9px',fontWeight:'600',color:s.pnl>0?'#26a69a':s.pnl<0?'#ef5350':'#8b949e'}}>{s.pnl!==0?(s.pnl>0?'+':'')+s.pnl.toFixed(0):'—'}</div>
                            <div style={{fontSize:'8px',color:'#8b949e'}}>{s.count||''}</div>
                          </div>
                          <div style={{fontSize:'9px',color:'#8b949e'}}>{d}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'14px'}}>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#e6edf3',marginBottom:'10px'}}>P&L by Hour (UTC)</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:'2px'}}>
                    {Array.from({length:24},(_,h)=>{
                      const s=hourMap[h]||{pnl:0,count:0}
                      const max=Math.max(...Object.values(hourMap).map(x=>Math.abs(x.pnl)),1)
                      const int=Math.abs(s.pnl)/max
                      return(
                        <div key={h} title={`${h}:00 UTC · ${s.count} trades · ${fmt(s.pnl)}`}
                          style={{borderRadius:'3px',padding:'4px 0',textAlign:'center',cursor:'default',
                            background:s.pnl>0?`rgba(38,166,154,${0.2+int*0.65})`:s.pnl<0?`rgba(239,83,80,${0.2+int*0.65})`:'#21262d'}}>
                          <div style={{fontSize:'8px',color:'#8b949e'}}>{h}</div>
                          <div style={{fontSize:'7px',color:s.pnl>0?'#26a69a':s.pnl<0?'#ef5350':'#8b949e',fontWeight:'600'}}>{s.count||''}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Full trade list — all fields */}
              <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid #21262d',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'13px',fontWeight:'500',color:'#e6edf3'}}>Trade Report ({closed.length})</span>
                  <button onClick={()=>router.push(`/backtest/${selected}`)}
                    style={{padding:'5px 12px',background:'#00d4aa',border:'none',borderRadius:'6px',color:'#0d1117',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>
                    Continue →
                  </button>
                </div>
                <div style={{maxHeight:'360px',overflowY:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead>
                      <tr style={{background:'#0d1117'}}>
                        {['#','Date','Dir','Entry','Exit','SL','TP','R','P&L','Strategy','Tags','Emotion',''].map(h=>(
                          <th key={h} style={{textAlign:'left',fontSize:'10px',color:'#8b949e',fontWeight:'500',padding:'7px 10px',borderBottom:'1px solid #21262d',whiteSpace:'nowrap'}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closed.map((t,i)=>(
                        <Fragment key={t.id||i}>
                          <tr style={{borderBottom:expanded===t.id?'none':'1px solid #21262d',borderLeft:`2px solid ${(t.net_pnl||0)>=0?'#26a69a':'#ef5350'}`}}>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#8b949e'}}>{i+1}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#8b949e',whiteSpace:'nowrap'}}>{t.trade_date}</td>
                            <td style={{padding:'6px 10px'}}>
                              <span style={{background:t.direction==='long'?'#0f3d2e':'#3d0f0f',color:t.direction==='long'?'#26a69a':'#ef5350',borderRadius:'4px',padding:'1px 6px',fontSize:'10px',fontWeight:'600'}}>{t.direction}</span>
                            </td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#8b949e'}}>{parseFloat(t.entry_price||0)}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#8b949e'}}>{parseFloat(t.exit_price||0)}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#8b949e'}}>{t.stop_loss?parseFloat(t.stop_loss):'—'}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#8b949e'}}>{t.take_profit?parseFloat(t.take_profit):'—'}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',fontWeight:'600',color:(t.r_multiple||0)>=0?'#26a69a':'#ef5350'}}>{(t.r_multiple||0).toFixed(2)}R</td>
                            <td style={{padding:'6px 10px',fontSize:'11px',fontWeight:'600',color:(t.net_pnl||0)>=0?'#26a69a':'#ef5350'}}>{fmt(t.net_pnl||0)}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#e6edf3',whiteSpace:'nowrap'}}>{t.strategy||'—'}</td>
                            <td style={{padding:'6px 10px',fontSize:'9px',color:'#8b949e',whiteSpace:'nowrap'}}>{t.setup_tags||'—'}</td>
                            <td style={{padding:'6px 10px',fontSize:'10px',color:'#79c0ff'}}>{t.emotion||'—'}</td>
                            <td style={{padding:'6px 10px'}}>
                              {t.notes&&<button onClick={()=>setExpanded(expanded===t.id?null:t.id)} style={{background:'none',border:'none',color:'#8b949e',cursor:'pointer',fontSize:'12px'}}>{expanded===t.id?'▲':'📝'}</button>}
                            </td>
                          </tr>
                          {expanded===t.id&&t.notes&&(
                            <tr key={(t.id||i)+'-note'} style={{borderBottom:'1px solid #21262d',borderLeft:`2px solid ${(t.net_pnl||0)>=0?'#26a69a':'#ef5350'}`}}>
                              <td colSpan={13} style={{padding:'8px 14px',fontSize:'11px',color:'#c9d1d9',background:'#0d1117',fontStyle:'italic'}}>📝 {t.notes}</td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>)}
          </div>
        ):(
          <div style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'48px',textAlign:'center'}}>
            <div style={{fontSize:'36px',marginBottom:'12px'}}>🔬</div>
            <p style={{color:'#8b949e',fontSize:'14px',margin:0}}>Select a session to see its report</p>
          </div>
        )}
      </div>
    </div>
  )
}
