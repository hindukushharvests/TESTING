'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'

const fmt = (v: number) => v >= 0 ? `$${Math.abs(v).toFixed(0)}` : `-$${Math.abs(v).toFixed(0)}`
const fmtSigned = (v: number) => v >= 0 ? `+$${Math.abs(v).toFixed(0)}` : `-$${Math.abs(v).toFixed(0)}`

export default function PropFirmsPage() {
  const supabase = createClient()
  const { canPropFirm } = useSubscription()
  const [accounts, setAccounts] = useState<any[]>([])
  const [logs, setLogs] = useState<Record<string, any[]>>({})
  const [tradeStats, setTradeStats] = useState({ totalPnl: 0, wins: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [saving, setSaving] = useState(false)
  const [updateBalanceFor, setUpdateBalanceFor] = useState<string|null>(null)
  const [newBalance, setNewBalance] = useState('')
  const [balanceNote, setBalanceNote] = useState('')
  const [msg, setMsg] = useState('')

  const emptyForm = { firm_name:'', account_size:'', max_daily_loss:'', max_total_drawdown:'', profit_target:'', current_balance:'', phase:'1', drawdown_type:'daily_reset', min_trading_days:'0', days_traded:'0', notes:'' }
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { if (canPropFirm) fetchAll() }, [canPropFirm])

  async function fetchAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: accs } = await supabase.from('prop_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setAccounts(accs || [])

    const { data: allLogs } = await supabase.from('prop_balance_log').select('*').eq('user_id', user.id).order('logged_date', { ascending: true })
    const grouped: Record<string, any[]> = {}
    ;(allLogs || []).forEach(l => { (grouped[l.account_id] ||= []).push(l) })
    setLogs(grouped)

    // Win rate + total P&L from all trades
    const [{ data: trades }, { data: imported }] = await Promise.all([
      supabase.from('trades').select('net_pnl').eq('user_id', user.id),
      supabase.from('imported_trades').select('net_pnl').eq('user_id', user.id),
    ])
    const all = [...(trades||[]), ...(imported||[])]
    setTradeStats({
      totalPnl: all.reduce((s,t)=>s+(t.net_pnl||0),0),
      wins: all.filter(t=>(t.net_pnl||0)>0).length,
      total: all.length,
    })
    setLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      user_id: user.id,
      firm_name: form.firm_name,
      account_size: parseFloat(form.account_size) || 0,
      max_daily_loss: parseFloat(form.max_daily_loss) || 0,
      max_total_drawdown: parseFloat(form.max_total_drawdown) || 0,
      profit_target: parseFloat(form.profit_target) || 0,
      current_balance: parseFloat(form.current_balance) || parseFloat(form.account_size) || 0,
      phase: form.phase,
      drawdown_type: form.drawdown_type,
      min_trading_days: parseInt(form.min_trading_days) || 0,
      days_traded: parseInt(form.days_traded) || 0,
      notes: form.notes,
      status: 'active',
    }
    if (editId) {
      await supabase.from('prop_accounts').update(payload).eq('id', editId)
    } else {
      const { data: created } = await supabase.from('prop_accounts').insert(payload).select().single()
      if (created) await supabase.from('prop_balance_log').insert({ user_id: user.id, account_id: created.id, balance: payload.current_balance, note: 'Account created' })
    }
    setForm(emptyForm); setShowForm(false); setEditId(null); setSaving(false); fetchAll()
  }

  async function saveBalance(accId: string) {
    const bal = parseFloat(newBalance)
    if (isNaN(bal)) { setMsg('Enter a valid balance'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('prop_accounts').update({ current_balance: bal }).eq('id', accId)
    await supabase.from('prop_balance_log').insert({ user_id: user.id, account_id: accId, balance: bal, note: balanceNote || null })
    setUpdateBalanceFor(null); setNewBalance(''); setBalanceNote(''); setMsg('✅ Balance updated'); setTimeout(()=>setMsg(''), 2000); fetchAll()
  }

  async function syncFromJournal(accId: string, acc: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const newBal = (acc.account_size || 0) + tradeStats.totalPnl
    await supabase.from('prop_accounts').update({ current_balance: newBal }).eq('id', accId)
    await supabase.from('prop_balance_log').insert({ user_id: user.id, account_id: accId, balance: newBal, note: `Synced from journal (P&L: ${fmtSigned(tradeStats.totalPnl)})` })
    setMsg(`✅ Synced — balance now ${fmt(newBal)}`); setTimeout(()=>setMsg(''), 3000); fetchAll()
  }

  function startEdit(acc: any) {
    setForm({
      firm_name: acc.firm_name||'', account_size: String(acc.account_size||''),
      max_daily_loss: String(acc.max_daily_loss||''), max_total_drawdown: String(acc.max_total_drawdown||''),
      profit_target: String(acc.profit_target||''), current_balance: String(acc.current_balance||''),
      phase: acc.phase||'1', drawdown_type: acc.drawdown_type||'daily_reset',
      min_trading_days: String(acc.min_trading_days||'0'), days_traded: String(acc.days_traded||'0'), notes: acc.notes||'',
    })
    setEditId(acc.id); setShowForm(true)
  }

  async function deleteAccount(id: string) {
    if (!confirm('Delete this account and all its history?')) return
    await supabase.from('prop_balance_log').delete().eq('account_id', id)
    await supabase.from('prop_accounts').delete().eq('id', id)
    fetchAll()
  }

  // ── SMART COACHING ENGINE ──
  function analyze(acc: any) {
    const pnl = (acc.current_balance||0) - (acc.account_size||0)
    const drawdown = Math.max(0, (acc.account_size||0) - (acc.current_balance||0))
    const profitNeeded = Math.max(0, (acc.profit_target||0) - pnl)
    const ddRoom = Math.max(0, (acc.max_total_drawdown||0) - drawdown)
    const ddPct = acc.max_total_drawdown ? (drawdown/acc.max_total_drawdown*100) : 0
    const profitPct = acc.profit_target ? Math.min(100, Math.max(0, pnl/acc.profit_target*100)) : 0
    const winRate = tradeStats.total ? (tradeStats.wins/tradeStats.total*100) : 0

    // Safe risk per trade: don't risk more than 25% of daily loss buffer per trade
    const dailyBuffer = acc.max_daily_loss || 0
    const safeRisk = dailyBuffer > 0 ? dailyBuffer * 0.25 : 0

    // Pass probability: blend of profit progress, dd safety, win rate
    const ddSafety = 100 - ddPct  // more room = safer
    const trajectory = pnl > 0 ? 60 : pnl === 0 ? 40 : 20
    let passProb = Math.round(
      profitPct * 0.35 +      // how close to target
      ddSafety * 0.30 +        // drawdown safety
      Math.min(winRate, 100) * 0.20 +  // skill
      trajectory * 0.15        // current direction
    )
    passProb = Math.max(0, Math.min(100, passProb))
    if (pnl >= (acc.profit_target||Infinity)) passProb = 100
    if (drawdown >= (acc.max_total_drawdown||Infinity)) passProb = 0

    // Build suggestions
    const tips: { icon: string; text: string; color: string }[] = []

    if (drawdown >= (acc.max_total_drawdown||Infinity)) {
      tips.push({ icon:'🔴', text:'Account BREACHED — max drawdown hit. This challenge is over.', color:'#f85149' })
    } else if (ddPct > 80) {
      tips.push({ icon:'🚨', text:`CRITICAL: ${ddPct.toFixed(0)}% of drawdown used. Only ${fmt(ddRoom)} left. Consider stopping for the day.`, color:'#f85149' })
    } else if (ddPct > 60) {
      tips.push({ icon:'⚠️', text:`Caution: ${ddPct.toFixed(0)}% drawdown used. ${fmt(ddRoom)} buffer remaining.`, color:'#e3b341' })
    }

    if (pnl >= (acc.profit_target||Infinity)) {
      if (acc.min_trading_days && acc.days_traded < acc.min_trading_days) {
        const daysLeft = acc.min_trading_days - acc.days_traded
        tips.push({ icon:'📅', text:`Target hit! But you need ${daysLeft} more trading day${daysLeft>1?'s':''} (min ${acc.min_trading_days}) before you can pass.`, color:'#e3b341' })
      } else {
        tips.push({ icon:'🎉', text:'Target reached & requirements met — you PASSED this phase!', color:'#3fb950' })
      }
    } else if (profitNeeded > 0) {
      tips.push({ icon:'🎯', text:`Need ${fmt(profitNeeded)} more to hit target (${profitPct.toFixed(0)}% there).`, color:'#00d4aa' })
    }

    if (safeRisk > 0 && drawdown < (acc.max_total_drawdown||Infinity)) {
      tips.push({ icon:'💰', text:`Safe risk per trade: ${fmt(safeRisk)} (¼ of daily buffer). Max ~4 losing trades before daily limit.`, color:'#8b949e' })
    }

    if (acc.min_trading_days > 0) {
      tips.push({ icon:'📊', text:`Trading days: ${acc.days_traded||0} / ${acc.min_trading_days} required.`, color:'#8b949e' })
    }

    if (tradeStats.total > 0) {
      tips.push({ icon: winRate>=50?'✅':'📉', text:`Your overall win rate: ${winRate.toFixed(0)}% across ${tradeStats.total} trades.`, color: winRate>=50?'#3fb950':'#e3b341' })
    }

    const status = pnl >= (acc.profit_target||Infinity) ? { label:'TARGET HIT', color:'#3fb950' }
      : drawdown >= (acc.max_total_drawdown||Infinity) ? { label:'BREACHED', color:'#f85149' }
      : { label: acc.status||'active', color:'#00d4aa' }

    return { pnl, drawdown, profitNeeded, ddRoom, ddPct, profitPct, winRate, safeRisk, passProb, tips, status }
  }

  if (!canPropFirm) return (
    <div style={{ maxWidth:'800px' }}>
      <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e6edf3', margin:'0 0 20px' }}>🏢 Prop Firm Tracker</h1>
      <UpgradeWall feature="Prop Firm Tracker" description="Track FTMO, MyFundedFX and other prop accounts with smart coaching. Monitor drawdown, get safe-risk suggestions, and pass probability — so you never blow a funded account. Elite plan only." requiredTier="elite"/>
    </div>
  )

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', color:'#8b949e' }}>Loading...</div>

  const card: React.CSSProperties = { background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', padding:'20px' }

  // Summary stats
  const active = accounts.filter(a => a.status === 'active').length
  const funded = accounts.filter(a => a.phase === 'funded' || a.status === 'funded').length
  const totalAtRisk = accounts.reduce((s,a)=>s+(a.account_size||0),0)
  const combinedPnl = accounts.reduce((s,a)=>s+((a.current_balance||0)-(a.account_size||0)),0)
  const avgPassProb = accounts.length ? Math.round(accounts.reduce((s,a)=>s+analyze(a).passProb,0)/accounts.length) : 0

  return (
    <div style={{ maxWidth:'1200px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>🏢 Prop Firm Tracker</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>Smart tracking & coaching for your challenges</p>
        </div>
        <button onClick={()=>{ setForm(emptyForm); setEditId(null); setShowForm(!showForm) }}
          style={{ padding:'10px 18px', background:'#00d4aa', border:'none', borderRadius:'8px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          {showForm ? '✕ Close' : '+ Add Account'}
        </button>
      </div>

      {msg && <div style={{ background:'rgba(63,185,80,0.1)', border:'1px solid rgba(63,185,80,0.3)', borderRadius:'10px', padding:'10px 16px', marginBottom:'16px', color:'#3fb950', fontSize:'13px' }}>{msg}</div>}

      {/* Summary cards */}
      {accounts.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px', marginBottom:'20px' }}>
          {[
            { l:'Active', v:active, c:'#00d4aa' },
            { l:'Funded', v:funded, c:'#e3b341' },
            { l:'Total at Risk', v:fmt(totalAtRisk), c:'#e6edf3' },
            { l:'Combined P&L', v:fmtSigned(combinedPnl), c:combinedPnl>=0?'#3fb950':'#f85149' },
            { l:'Avg Pass Prob', v:`${avgPassProb}%`, c:avgPassProb>=70?'#3fb950':avgPassProb>=40?'#e3b341':'#f85149' },
          ].map(s => (
            <div key={s.l} style={{ ...card, padding:'16px' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'6px' }}>{s.l}</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ ...card, marginBottom:'20px' }}>
          <div style={{ fontSize:'15px', fontWeight:'600', color:'#e6edf3', marginBottom:'16px' }}>{editId ? 'Edit Account' : 'New Prop Account'}</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'14px' }}>
              {[
                { k:'firm_name', l:'Firm Name', ph:'FTMO, MyFundedFX...', type:'text' },
                { k:'account_size', l:'Account Size ($)', ph:'100000', type:'number' },
                { k:'current_balance', l:'Current Balance ($)', ph:'100000', type:'number' },
                { k:'profit_target', l:'Profit Target ($)', ph:'10000', type:'number' },
                { k:'max_daily_loss', l:'Max Daily Loss ($)', ph:'5000', type:'number' },
                { k:'max_total_drawdown', l:'Max Drawdown ($)', ph:'10000', type:'number' },
              ].map(f => (
                <div key={f.k}>
                  <label style={{ display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }}>{f.l}</label>
                  <input type={f.type} value={(form as any)[f.k]} onChange={e=>setForm({...form, [f.k]: e.target.value})} placeholder={f.ph} required={f.k==='firm_name'||f.k==='account_size'}
                    style={{ width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }}>Phase</label>
                <select value={form.phase} onChange={e=>setForm({...form, phase: e.target.value})} style={{ width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none' }}>
                  <option value="1">Phase 1 (Challenge)</option>
                  <option value="2">Phase 2 (Verification)</option>
                  <option value="funded">Funded</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }}>Drawdown Type</label>
                <select value={form.drawdown_type} onChange={e=>setForm({...form, drawdown_type: e.target.value})} style={{ width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none' }}>
                  <option value="daily_reset">Daily Reset</option>
                  <option value="from_balance">From Balance</option>
                  <option value="trailing">Trailing</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }}>Min Trading Days (0=none)</label>
                <input type="number" value={form.min_trading_days} onChange={e=>setForm({...form, min_trading_days: e.target.value})} placeholder="0"
                  style={{ width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:'12px', marginBottom:'14px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }}>Days Traded So Far</label>
                <input type="number" value={form.days_traded} onChange={e=>setForm({...form, days_traded: e.target.value})} placeholder="0"
                  style={{ width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }}>Notes</label>
                <input type="text" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Optional"
                  style={{ width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none', boxSizing:'border-box' }}/>
              </div>
            </div>
            <button type="submit" disabled={saving} style={{ padding:'10px 24px', background:'#00d4aa', border:'none', borderRadius:'8px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {saving ? 'Saving...' : editId ? 'Update Account' : 'Create Account'}
            </button>
          </form>
        </div>
      )}

      {accounts.length === 0 ? (
        <div style={{ ...card, textAlign:'center', padding:'48px' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>🏢</div>
          <p style={{ color:'#8b949e', fontSize:'14px' }}>No prop accounts yet. Add your first challenge.</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(440px,1fr))', gap:'16px' }}>
          {accounts.map(acc => {
            const A = analyze(acc)
            const accLogs = logs[acc.id] || []
            return (
              <div key={acc.id} style={card}>
                {/* Header */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                  <div>
                    <div style={{ fontSize:'17px', fontWeight:'700', color:'#e6edf3' }}>{acc.firm_name}</div>
                    <div style={{ fontSize:'12px', color:'#8b949e' }}>{fmt(acc.account_size)} · {acc.phase==='funded'?'💰 Funded':`Phase ${acc.phase}`}</div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                    <span style={{ background:`${A.status.color}22`, color:A.status.color, fontSize:'10px', padding:'3px 10px', borderRadius:'12px', fontWeight:'700', textTransform:'uppercase' }}>{A.status.label}</span>
                    <button onClick={()=>startEdit(acc)} style={{ background:'#21262d', border:'none', borderRadius:'6px', width:'26px', height:'26px', color:'#8b949e', cursor:'pointer', fontSize:'12px' }}>✏️</button>
                    <button onClick={()=>deleteAccount(acc.id)} style={{ background:'#21262d', border:'none', borderRadius:'6px', width:'26px', height:'26px', color:'#f85149', cursor:'pointer', fontSize:'12px' }}>🗑</button>
                  </div>
                </div>

                {/* Pass probability gauge */}
                <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'16px', padding:'12px', background:'#0d1117', borderRadius:'10px' }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#21262d" strokeWidth="6"/>
                    <circle cx="32" cy="32" r="26" fill="none" stroke={A.passProb>=70?'#3fb950':A.passProb>=40?'#e3b341':'#f85149'} strokeWidth="6" strokeDasharray={`${A.passProb/100*163} 163`} strokeLinecap="round" transform="rotate(-90 32 32)"/>
                    <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="800" fill="#e6edf3">{A.passProb}</text>
                  </svg>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:A.passProb>=70?'#3fb950':A.passProb>=40?'#e3b341':'#f85149' }}>Pass Probability</div>
                    <div style={{ fontSize:'11px', color:'#8b949e' }}>{A.passProb>=70?'On track to pass':A.passProb>=40?'Needs improvement':'High risk of failing'}</div>
                  </div>
                </div>

                {/* Balance row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
                  {[['Balance', fmt(acc.current_balance), '#e6edf3'],['P&L', fmtSigned(A.pnl), A.pnl>=0?'#3fb950':'#f85149'],['Target', fmt(acc.profit_target), '#e3b341']].map(([l,v,c])=>(
                    <div key={l} style={{ background:'#0d1117', borderRadius:'8px', padding:'10px', textAlign:'center' }}>
                      <div style={{ fontSize:'9px', color:'#8b949e', textTransform:'uppercase' }}>{l}</div>
                      <div style={{ fontSize:'15px', fontWeight:'700', color:c as string }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bars */}
                <div style={{ marginBottom:'8px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px' }}>
                    <span style={{ color:'#8b949e' }}>Profit Progress</span>
                    <span style={{ color:'#3fb950' }}>{fmt(A.pnl)} / {fmt(acc.profit_target)}</span>
                  </div>
                  <div style={{ height:'7px', background:'#21262d', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${A.profitPct}%`, height:'100%', background:'linear-gradient(90deg,#00d4aa,#3fb950)', borderRadius:'4px' }}/>
                  </div>
                </div>
                <div style={{ marginBottom:'14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'4px' }}>
                    <span style={{ color:'#8b949e' }}>Drawdown Used</span>
                    <span style={{ color: A.ddPct>70?'#f85149':A.ddPct>40?'#e3b341':'#8b949e' }}>{fmt(A.drawdown)} / {fmt(acc.max_total_drawdown)}</span>
                  </div>
                  <div style={{ height:'7px', background:'#21262d', borderRadius:'4px', overflow:'hidden' }}>
                    <div style={{ width:`${A.ddPct}%`, height:'100%', background: A.ddPct>70?'#f85149':A.ddPct>40?'#e3b341':'#3fb950', borderRadius:'4px' }}/>
                  </div>
                </div>

                {/* SMART COACHING */}
                <div style={{ background:'#0d1117', borderRadius:'10px', padding:'12px', marginBottom:'12px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'600', color:'#e6edf3', marginBottom:'10px', display:'flex', alignItems:'center', gap:'5px' }}>🧠 Smart Coaching</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {A.tips.map((t,i)=>(
                      <div key={i} style={{ display:'flex', gap:'8px', fontSize:'11px', color:'#e6edf3', lineHeight:'1.5', alignItems:'flex-start' }}>
                        <span style={{ flexShrink:0 }}>{t.icon}</span>
                        <span style={{ color: t.color }}>{t.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Balance history */}
                {accLogs.length > 1 && (
                  <div style={{ marginBottom:'12px' }}>
                    <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'6px' }}>Balance History</div>
                    <svg width="100%" height="44" viewBox="0 0 400 44" preserveAspectRatio="none">
                      {(() => {
                        const vals = accLogs.map(l=>l.balance); const mn=Math.min(...vals),mx=Math.max(...vals),rng=mx-mn||1
                        const pts = accLogs.map((l,i)=>`${(i/(accLogs.length-1))*400},${40-((l.balance-mn)/rng)*36}`).join(' ')
                        return <polyline points={pts} fill="none" stroke="#00d4aa" strokeWidth="2"/>
                      })()}
                    </svg>
                  </div>
                )}

                {/* Update balance */}
                {updateBalanceFor === acc.id ? (
                  <div style={{ background:'#0d1117', borderRadius:'8px', padding:'12px' }}>
                    <input type="number" value={newBalance} onChange={e=>setNewBalance(e.target.value)} placeholder="New balance"
                      style={{ width:'100%', padding:'8px 10px', background:'#161b22', border:'1px solid #30363d', borderRadius:'6px', color:'#e6edf3', fontSize:'13px', outline:'none', boxSizing:'border-box', marginBottom:'8px' }}/>
                    <input type="text" value={balanceNote} onChange={e=>setBalanceNote(e.target.value)} placeholder="Note (optional)"
                      style={{ width:'100%', padding:'8px 10px', background:'#161b22', border:'1px solid #30363d', borderRadius:'6px', color:'#e6edf3', fontSize:'12px', outline:'none', boxSizing:'border-box', marginBottom:'8px' }}/>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={()=>saveBalance(acc.id)} style={{ flex:1, padding:'8px', background:'#00d4aa', border:'none', borderRadius:'6px', color:'#0d1117', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>Save</button>
                      <button onClick={()=>{setUpdateBalanceFor(null);setNewBalance('');setBalanceNote('')}} style={{ padding:'8px 14px', background:'#21262d', border:'1px solid #30363d', borderRadius:'6px', color:'#8b949e', fontSize:'12px', cursor:'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={()=>{setUpdateBalanceFor(acc.id);setNewBalance(String(acc.current_balance||''))}}
                      style={{ flex:1, padding:'8px', background:'#21262d', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>💰 Update Balance</button>
                    <button onClick={()=>syncFromJournal(acc.id, acc)}
                      style={{ flex:1, padding:'8px', background:'rgba(0,212,170,0.1)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'7px', color:'#00d4aa', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>🔄 Sync Journal</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ height:'40px' }}/>
    </div>
  )
}
