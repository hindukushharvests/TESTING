'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'

const MARKETS = ['All','Stocks','Forex','Crypto','Futures','Options']
const fmt = (v:number)=>{ const a=Math.abs(v).toFixed(0); return v>=0?`+$${a}`:`-$${a}` }

export default function PlaybooksPage() {
  const supabase = createClient()
  const { canPlaybooks } = useSubscription()
  const [playbooks, setPlaybooks] = useState<any[]>([])
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [selected, setSelected] = useState<any|null>(null)
  const [saving, setSaving] = useState(false)
  const [checklistInput, setChecklistInput] = useState('')

  const empty = { name:'', description:'', market:'Crypto', timeframe:'', entry_rules:'', exit_rules:'', risk_rules:'', checklist:[] as string[], match_tags:[] as string[], is_active:true }
  const [form, setForm] = useState<any>(empty)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => { if (canPlaybooks) loadAll() }, [canPlaybooks])

  async function loadAll() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: pbs }, { data: trs }] = await Promise.all([
      supabase.from('playbooks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('trades').select('*').eq('user_id', user.id),
    ])
    setPlaybooks(pbs || [])
    setTrades(trs || [])
    setLoading(false)
  }

  // Compute performance for a playbook (dropdown link OR tag match)
  function perf(pb: any) {
    const linked = trades.filter(t => {
      if (t.status !== 'closed') return false
      if (t.playbook_id === pb.id) return true
      // tag match
      if (pb.match_tags?.length && t.setup_tags?.length) {
        return pb.match_tags.some((mt: string) => t.setup_tags.includes(mt))
      }
      return false
    })
    const wins = linked.filter(t => (t.net_pnl||0) > 0)
    const pnl = linked.reduce((s,t)=>s+(t.net_pnl||0),0)
    const wr = linked.length ? wins.length/linked.length*100 : 0
    const grossW = wins.reduce((s,t)=>s+(t.net_pnl||0),0)
    const grossL = Math.abs(linked.filter(t=>(t.net_pnl||0)<=0).reduce((s,t)=>s+(t.net_pnl||0),0))
    const pf = grossL===0?grossW:grossW/grossL
    return { count: linked.length, wins: wins.length, pnl, wr, pf, linked }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = {
      user_id: user.id,
      name: form.name, description: form.description, market: form.market,
      timeframe: form.timeframe, entry_rules: form.entry_rules, exit_rules: form.exit_rules,
      risk_rules: form.risk_rules, checklist: form.checklist, match_tags: form.match_tags,
      is_active: form.is_active,
      rules: form.entry_rules, // keep old column populated for compatibility
    }
    if (editId) await supabase.from('playbooks').update(payload).eq('id', editId)
    else await supabase.from('playbooks').insert(payload)
    setForm(empty); setShowForm(false); setEditId(null); setSaving(false); loadAll()
  }

  function startEdit(pb: any) {
    setForm({
      name:pb.name||'', description:pb.description||'', market:pb.market||'Crypto',
      timeframe:pb.timeframe||'', entry_rules:pb.entry_rules||'', exit_rules:pb.exit_rules||'',
      risk_rules:pb.risk_rules||'', checklist:pb.checklist||[], match_tags:pb.match_tags||[], is_active:pb.is_active!==false,
    })
    setEditId(pb.id); setShowForm(true); setSelected(null)
  }

  async function del(id: string) {
    if (!confirm('Delete this playbook?')) return
    await supabase.from('playbooks').delete().eq('id', id)
    setSelected(null); loadAll()
  }

  function addChecklistItem() {
    if (checklistInput.trim()) { setForm({...form, checklist:[...form.checklist, checklistInput.trim()]}); setChecklistInput('') }
  }
  function addTag() {
    if (tagInput.trim()) { setForm({...form, match_tags:[...form.match_tags, tagInput.trim()]}); setTagInput('') }
  }

  if (!canPlaybooks) return (
    <div style={{ maxWidth:'800px' }}>
      <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e6edf3', margin:'0 0 20px' }}>📚 Playbooks</h1>
      <UpgradeWall feature="Playbooks" description="Build structured strategy playbooks with rules, checklists, and live performance tracking. See which strategies actually make you money. Upgrade to Pro." requiredTier="pro"/>
    </div>
  )

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'50vh', color:'#8b949e' }}>Loading...</div>

  const card: React.CSSProperties = { background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', padding:'20px' }

  // Ranking
  const ranked = playbooks.map(p => ({ pb:p, ...perf(p) })).filter(r=>r.count>0).sort((a,b)=>b.pnl-a.pnl)
  const best = ranked[0], worst = ranked[ranked.length-1]

  return (
    <div style={{ maxWidth:'1100px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>📚 Playbooks</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>{playbooks.length} strategies · performance tracked from your trades</p>
        </div>
        <button onClick={()=>{ setForm(empty); setEditId(null); setShowForm(!showForm); setSelected(null) }}
          style={{ padding:'10px 18px', background:'#00d4aa', border:'none', borderRadius:'8px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
          {showForm ? '✕ Close' : '+ New Playbook'}
        </button>
      </div>

      {/* Ranking banner */}
      {ranked.length > 1 && !showForm && !selected && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'20px' }}>
          <div style={{ ...card, background:'linear-gradient(135deg,rgba(63,185,80,0.08),#161b22)', border:'1px solid rgba(63,185,80,0.25)' }}>
            <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', marginBottom:'6px' }}>🏆 Best Strategy</div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:'#e6edf3' }}>{best.pb.name}</div>
            <div style={{ fontSize:'13px', color:'#3fb950', marginTop:'2px' }}>{fmt(best.pnl)} · {best.wr.toFixed(0)}% WR · {best.count} trades</div>
          </div>
          {worst && worst.pnl < 0 && (
            <div style={{ ...card, background:'linear-gradient(135deg,rgba(248,81,73,0.08),#161b22)', border:'1px solid rgba(248,81,73,0.25)' }}>
              <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', marginBottom:'6px' }}>📉 Needs Work</div>
              <div style={{ fontSize:'16px', fontWeight:'700', color:'#e6edf3' }}>{worst.pb.name}</div>
              <div style={{ fontSize:'13px', color:'#f85149', marginTop:'2px' }}>{fmt(worst.pnl)} · {worst.wr.toFixed(0)}% WR · consider revising</div>
            </div>
          )}
        </div>
      )}

      {/* FORM */}
      {showForm && (
        <div style={{ ...card, marginBottom:'20px' }}>
          <div style={{ fontSize:'15px', fontWeight:'600', color:'#e6edf3', marginBottom:'16px' }}>{editId?'Edit Playbook':'New Playbook'}</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:'12px', marginBottom:'14px' }}>
              <div>
                <label style={lbl}>Strategy Name *</label>
                <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="e.g. ICT Breakout" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Market</label>
                <select value={form.market} onChange={e=>setForm({...form,market:e.target.value})} style={inp}>
                  {MARKETS.filter(m=>m!=='All').map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Timeframe</label>
                <input value={form.timeframe} onChange={e=>setForm({...form,timeframe:e.target.value})} placeholder="1H, 4H, Daily" style={inp}/>
              </div>
            </div>
            <div style={{ marginBottom:'14px' }}>
              <label style={lbl}>Description</label>
              <input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Brief overview" style={inp}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'14px' }}>
              <div>
                <label style={lbl}>📥 Entry Rules</label>
                <textarea value={form.entry_rules} onChange={e=>setForm({...form,entry_rules:e.target.value})} placeholder="When do you enter?" style={{...inp, minHeight:'70px', resize:'vertical'}}/>
              </div>
              <div>
                <label style={lbl}>📤 Exit Rules</label>
                <textarea value={form.exit_rules} onChange={e=>setForm({...form,exit_rules:e.target.value})} placeholder="TP / SL strategy" style={{...inp, minHeight:'70px', resize:'vertical'}}/>
              </div>
              <div>
                <label style={lbl}>⚠️ Risk Rules</label>
                <textarea value={form.risk_rules} onChange={e=>setForm({...form,risk_rules:e.target.value})} placeholder="Position sizing, max risk" style={{...inp, minHeight:'70px', resize:'vertical'}}/>
              </div>
            </div>

            {/* Checklist builder */}
            <div style={{ marginBottom:'14px' }}>
              <label style={lbl}>✅ Pre-Trade Checklist</label>
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                <input value={checklistInput} onChange={e=>setChecklistInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addChecklistItem()}}} placeholder="Add a check item + Enter" style={inp}/>
                <button type="button" onClick={addChecklistItem} style={{ padding:'0 16px', background:'#21262d', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', cursor:'pointer', fontSize:'13px' }}>Add</button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {form.checklist.map((c:string,i:number)=>(
                  <span key={i} style={{ background:'#0d1117', border:'1px solid #30363d', borderRadius:'6px', padding:'4px 10px', fontSize:'11px', color:'#e6edf3', display:'flex', alignItems:'center', gap:'6px' }}>
                    ☐ {c} <span onClick={()=>setForm({...form,checklist:form.checklist.filter((_:any,idx:number)=>idx!==i)})} style={{ cursor:'pointer', color:'#f85149' }}>✕</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Match tags */}
            <div style={{ marginBottom:'16px' }}>
              <label style={lbl}>🏷️ Auto-Match Tags (trades with these setup tags count toward this playbook)</label>
              <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
                <input value={tagInput} onChange={e=>setTagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addTag()}}} placeholder="e.g. Breakout, VWAP + Enter" style={inp}/>
                <button type="button" onClick={addTag} style={{ padding:'0 16px', background:'#21262d', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', cursor:'pointer', fontSize:'13px' }}>Add</button>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {form.match_tags.map((t:string,i:number)=>(
                  <span key={i} style={{ background:'rgba(0,212,170,0.1)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'6px', padding:'4px 10px', fontSize:'11px', color:'#00d4aa', display:'flex', alignItems:'center', gap:'6px' }}>
                    {t} <span onClick={()=>setForm({...form,match_tags:form.match_tags.filter((_:any,idx:number)=>idx!==i)})} style={{ cursor:'pointer' }}>✕</span>
                  </span>
                ))}
              </div>
            </div>

            <button type="submit" disabled={saving} style={{ padding:'10px 24px', background:'#00d4aa', border:'none', borderRadius:'8px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {saving?'Saving...':editId?'Update Playbook':'Create Playbook'}
            </button>
          </form>
        </div>
      )}

      {/* DETAIL VIEW */}
      {selected && !showForm && (() => {
        const P = perf(selected)
        return (
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <h2 style={{ fontSize:'18px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>{selected.name}</h2>
                <div style={{ fontSize:'12px', color:'#8b949e' }}>{selected.market} · {selected.timeframe||'Any TF'}</div>
              </div>
              <div style={{ display:'flex', gap:'6px' }}>
                <button onClick={()=>startEdit(selected)} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'7px', padding:'6px 12px', color:'#e6edf3', cursor:'pointer', fontSize:'12px' }}>✏️ Edit</button>
                <button onClick={()=>del(selected.id)} style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'7px', padding:'6px 12px', color:'#f85149', cursor:'pointer', fontSize:'12px' }}>🗑 Delete</button>
                <button onClick={()=>setSelected(null)} style={{ background:'#21262d', border:'none', borderRadius:'7px', width:'30px', color:'#8b949e', cursor:'pointer' }}>✕</button>
              </div>
            </div>

            {/* Performance */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
              {[
                { l:'Trades', v:P.count, c:'#e6edf3' },
                { l:'Win Rate', v:`${P.wr.toFixed(0)}%`, c:P.wr>=50?'#3fb950':'#e3b341' },
                { l:'Net P&L', v:fmt(P.pnl), c:P.pnl>=0?'#3fb950':'#f85149' },
                { l:'Profit Factor', v:P.pf.toFixed(2), c:P.pf>=1?'#3fb950':'#f85149' },
              ].map(s=>(
                <div key={s.l} style={{ background:'#0d1117', borderRadius:'10px', padding:'14px', textAlign:'center' }}>
                  <div style={{ fontSize:'9px', color:'#8b949e', textTransform:'uppercase', marginBottom:'4px' }}>{s.l}</div>
                  <div style={{ fontSize:'20px', fontWeight:'800', color:s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
            {P.count === 0 && (
              <div style={{ background:'rgba(227,179,65,0.08)', border:'1px solid rgba(227,179,65,0.25)', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#e3b341', marginBottom:'20px' }}>
                💡 No trades linked yet. Tag trades with {selected.match_tags?.length?selected.match_tags.join(', '):'matching tags'} or pick this playbook when logging a trade.
              </div>
            )}

            {selected.description && <p style={{ color:'#8b949e', fontSize:'13px', marginBottom:'16px', lineHeight:'1.6' }}>{selected.description}</p>}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'16px' }}>
              {[['📥 Entry Rules',selected.entry_rules],['📤 Exit Rules',selected.exit_rules],['⚠️ Risk Rules',selected.risk_rules]].map(([t,v])=>(
                <div key={t as string} style={{ background:'#0d1117', borderRadius:'10px', padding:'14px' }}>
                  <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', marginBottom:'8px' }}>{t}</div>
                  <div style={{ fontSize:'12px', color:'#8b949e', lineHeight:'1.6', whiteSpace:'pre-wrap' }}>{v||'—'}</div>
                </div>
              ))}
            </div>

            {selected.checklist?.length > 0 && (
              <div style={{ background:'#0d1117', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
                <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', marginBottom:'10px' }}>✅ Pre-Trade Checklist</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {selected.checklist.map((c:string,i:number)=>(
                    <div key={i} style={{ fontSize:'12px', color:'#e6edf3', display:'flex', gap:'8px' }}>☐ {c}</div>
                  ))}
                </div>
              </div>
            )}

            {selected.match_tags?.length > 0 && (
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {selected.match_tags.map((t:string)=>(
                  <span key={t} style={{ background:'rgba(0,212,170,0.1)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'6px', padding:'3px 10px', fontSize:'11px', color:'#00d4aa' }}>🏷️ {t}</span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* LIST */}
      {!selected && !showForm && (
        playbooks.length === 0 ? (
          <div style={{ ...card, textAlign:'center', padding:'48px' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>📚</div>
            <div style={{ color:'#e6edf3', fontSize:'15px', fontWeight:'500', marginBottom:'6px' }}>No playbooks yet</div>
            <div style={{ color:'#8b949e', fontSize:'13px' }}>Create your first strategy with rules + performance tracking</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'14px' }}>
            {playbooks.map(pb=>{
              const P = perf(pb)
              const profitable = P.count>0 && P.pnl>0
              return (
                <div key={pb.id} onClick={()=>setSelected(pb)} style={{ ...card, cursor:'pointer', transition:'transform 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-3px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <div>
                      <div style={{ fontSize:'15px', fontWeight:'700', color:'#e6edf3' }}>{pb.name}</div>
                      <div style={{ fontSize:'11px', color:'#8b949e' }}>{pb.market} · {pb.timeframe||'Any'}</div>
                    </div>
                    {P.count>0 && (
                      <span style={{ background: profitable?'rgba(63,185,80,0.15)':'rgba(248,81,73,0.15)', color:profitable?'#3fb950':'#f85149', fontSize:'9px', padding:'3px 8px', borderRadius:'10px', fontWeight:'700' }}>
                        {profitable?'PROFITABLE':'LOSING'}
                      </span>
                    )}
                  </div>
                  {pb.description && <p style={{ fontSize:'12px', color:'#8b949e', margin:'0 0 12px', lineHeight:'1.5', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{pb.description}</p>}
                  {P.count>0 ? (
                    <div style={{ display:'flex', gap:'12px', fontSize:'12px' }}>
                      <span style={{ color: P.pnl>=0?'#3fb950':'#f85149', fontWeight:'700' }}>{fmt(P.pnl)}</span>
                      <span style={{ color:'#8b949e' }}>{P.wr.toFixed(0)}% WR</span>
                      <span style={{ color:'#8b949e' }}>{P.count} trades</span>
                    </div>
                  ) : (
                    <div style={{ fontSize:'11px', color:'#8b949e' }}>No linked trades yet</div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
      <div style={{ height:'40px' }}/>
    </div>
  )
}

const lbl: React.CSSProperties = { display:'block', fontSize:'11px', color:'#8b949e', marginBottom:'5px' }
const inp: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'13px', outline:'none', boxSizing:'border-box', fontFamily:'inherit' }
