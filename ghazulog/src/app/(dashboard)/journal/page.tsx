'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'

const SETUP_TAGS = ['ORB','Breakout','VWAP','Gap Fill','Trend','Reversal','Scalp','Swing','News','Support/Resistance']
const MISTAKE_TAGS = ['FOMO','Revenge','Oversize','Early Entry','Late Entry','No Stop','Moved Stop','Overtrade']

export default function JournalPage() {
  const supabase = createClient()
  const { tier, canLogTrade, tradesRemaining, limits, todayTrades, incrementTrades } = useSubscription()
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    symbol: '', trade_date: new Date().toISOString().slice(0,10),
    trade_time: '', direction: 'long', market: 'stocks',
    entry_price: '', exit_price: '', quantity: '',
    fees: '0', notes: '', status: 'closed',
    setup_tags: [] as string[], mistake_tags: [] as string[]
  })

  async function fetchTrades() {
    const { data } = await supabase.from('trades').select('*').order('trade_date', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchTrades() }, [])

  const [customSetup, setCustomSetup] = useState('')
  const [customMistake, setCustomMistake] = useState('')

  function addCustomTag(type: 'setup_tags' | 'mistake_tags', value: string) {
    const v = value.trim()
    if (!v) return
    setForm((f: any) => f[type].includes(v) ? f : ({ ...f, [type]: [...f[type], v] }))
    if (type === 'setup_tags') setCustomSetup('')
    else setCustomMistake('')
  }

  function toggleTag(type: 'setup_tags' | 'mistake_tags', tag: string) {
    setForm(f => ({
      ...f,
      [type]: f[type].includes(tag) ? f[type].filter(t => t !== tag) : [...f[type], tag]
    }))
  }

  function calcPnl() {
    const entry = parseFloat(form.entry_price)
    const exit = parseFloat(form.exit_price)
    const qty = parseFloat(form.quantity)
    const fees = parseFloat(form.fees) || 0
    if (!entry || !exit || !qty) return null
    const gross = form.direction === 'long' ? (exit - entry) * qty : (entry - exit) * qty
    return parseFloat((gross - fees).toFixed(2))
  }

  async function handleSubmit(e: React.FormEvent) {
    if (!canLogTrade) {
      setError(`Daily limit reached. ${tier === 'free' ? 'Upgrade to Pro for 30 trades/day.' : 'Upgrade to Elite for unlimited trades.'}`)
      return
    }
    e.preventDefault()
    setSaving(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const net_pnl = calcPnl()
    const entry = parseFloat(form.entry_price)
    const exit = parseFloat(form.exit_price) || null
    const qty = parseFloat(form.quantity)
    const gross_pnl = entry && exit && qty
      ? form.direction === 'long' ? (exit - entry) * qty : (entry - exit) * qty
      : null

    const payload = {
      user_id: user.id,
      symbol: form.symbol.toUpperCase(),
      trade_date: form.trade_date,
      trade_time: form.trade_time || null,
      direction: form.direction,
      market: form.market,
      entry_price: entry,
      exit_price: exit,
      quantity: qty,
      gross_pnl,
      fees: parseFloat(form.fees) || 0,
      net_pnl,
      setup_tags: form.setup_tags,
      mistake_tags: form.mistake_tags,
      notes: form.notes,
      status: form.status,
    }
    const { error: err } = editingId
      ? await supabase.from('trades').update(payload).eq('id', editingId)
      : await supabase.from('trades').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }

    setForm({ symbol:'', trade_date: new Date().toISOString().slice(0,10), trade_time:'', direction:'long', market:'stocks', entry_price:'', exit_price:'', quantity:'', fees:'0', notes:'', status:'closed', setup_tags:[], mistake_tags:[] })
    if (!editingId) await incrementTrades()
    setEditingId(null)
    setShowForm(false)
    fetchTrades()
    setSaving(false)
  }

  function openEdit(t: any) {
    setForm({
      symbol: t.symbol || '',
      trade_date: t.trade_date || new Date().toISOString().slice(0,10),
      trade_time: t.trade_time || '',
      direction: t.direction || 'long',
      market: t.market || 'stocks',
      entry_price: t.entry_price != null ? String(t.entry_price) : '',
      exit_price: t.exit_price != null ? String(t.exit_price) : '',
      quantity: t.quantity != null ? String(t.quantity) : '',
      fees: t.fees != null ? String(t.fees) : '0',
      notes: t.notes || '',
      status: t.status || 'closed',
      setup_tags: t.setup_tags || [],
      mistake_tags: t.mistake_tags || [],
    })
    setEditingId(t.id)
    setShowForm(true)
  }

  async function quickClose(t: any) {
    const val = prompt(`Close ${t.symbol} ${t.direction} — enter exit price:`)
    if (val === null) return
    const exit = parseFloat(val)
    if (!exit) { alert('Enter a valid exit price'); return }
    const entry = parseFloat(t.entry_price)
    const qty = parseFloat(t.quantity)
    const fees = parseFloat(t.fees) || 0
    const gross = t.direction === 'long' ? (exit - entry) * qty : (entry - exit) * qty
    const net_pnl = parseFloat((gross - fees).toFixed(2))
    await supabase.from('trades').update({ exit_price: exit, gross_pnl: gross, net_pnl, status: 'closed' }).eq('id', t.id)
    fetchTrades()
  }

  async function deleteTrade(id: string) {
    if (!confirm('Delete this trade?')) return
    await supabase.from('trades').delete().eq('id', id)
    fetchTrades()
  }

  const fmt = (v: number) => { const a = Math.abs(v).toFixed(2); return v >= 0 ? `+$${a}` : `-$${a}` }
  const netPnl = calcPnl()

  const filtered = filter === 'all' ? trades
    : filter === 'wins' ? trades.filter(t => (t.net_pnl||0) > 0)
    : filter === 'losses' ? trades.filter(t => (t.net_pnl||0) <= 0)
    : trades.filter(t => t.market === filter)

  const inp = (extra?: any) => ({
    style: {
      width:'100%', padding:'9px 12px', background:'#0d1117',
      border:'1px solid #30363d', borderRadius:'8px',
      color:'#e6edf3', fontSize:'13px', outline:'none',
      boxSizing:'border-box' as const, ...extra
    }
  })

  return (
    <div style={{ maxWidth:'1200px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:'600', color:'#e6edf3', margin:'0 0 4px' }}>Trade Journal</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>{trades.length} total trades</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding:'9px 18px', background:'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
          {showForm ? '✕ Cancel' : '+ Add Trade'}
        </button>
      </div>

      {/* Add Trade Form */}
      {showForm && (
        <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'12px', padding:'24px', marginBottom:'20px' }}>
          <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#e6edf3', margin:'0 0 20px' }}>New Trade</h2>
          <form onSubmit={handleSubmit}>
            {/* Row 1 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Symbol *</label>
                <input {...inp()} value={form.symbol} onChange={e => setForm(f=>({...f,symbol:e.target.value}))} placeholder="AAPL" required />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Market</label>
                <select {...inp()} value={form.market} onChange={e => setForm(f=>({...f,market:e.target.value}))}>
                  <option value="stocks">Stocks</option>
                  <option value="forex">Forex</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Date *</label>
                <input {...inp()} type="date" value={form.trade_date} onChange={e => setForm(f=>({...f,trade_date:e.target.value}))} required />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Time</label>
                <input {...inp()} type="time" value={form.trade_time} onChange={e => setForm(f=>({...f,trade_time:e.target.value}))} />
              </div>
            </div>

            {/* Row 2 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Direction *</label>
                <select {...inp()} value={form.direction} onChange={e => setForm(f=>({...f,direction:e.target.value}))}>
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Entry Price *</label>
                <input {...inp()} type="number" step="any" value={form.entry_price} onChange={e => setForm(f=>({...f,entry_price:e.target.value}))} placeholder="0.00" required />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Exit Price</label>
                <input {...inp()} type="number" step="any" value={form.exit_price} onChange={e => setForm(f=>({...f,exit_price:e.target.value}))} placeholder="0.00" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Quantity *</label>
                <input {...inp()} type="number" step="any" value={form.quantity} onChange={e => setForm(f=>({...f,quantity:e.target.value}))} placeholder="100" required />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Fees</label>
                <input {...inp()} type="number" step="any" value={form.fees} onChange={e => setForm(f=>({...f,fees:e.target.value}))} placeholder="0.00" />
              </div>
            </div>

            {/* Status + PnL preview */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Status</label>
                <select {...inp()} value={form.status} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                  <option value="closed">Closed</option>
                  <option value="open">Open</option>
                </select>
              </div>
              <div style={{ display:'flex', alignItems:'flex-end' }}>
                {netPnl !== null && (
                  <div style={{ background: netPnl >= 0 ? '#0f3d2e' : '#3d0f0f', border:`1px solid ${netPnl >= 0 ? '#3fb950' : '#f85149'}`, borderRadius:'8px', padding:'9px 16px', width:'100%', textAlign:'center' }}>
                    <span style={{ fontSize:'11px', color:'#8b949e' }}>Calculated P&L: </span>
                    <span style={{ fontSize:'16px', fontWeight:'600', color: netPnl >= 0 ? '#3fb950' : '#f85149' }}>{fmt(netPnl)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Setup Tags */}
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'8px' }}>Setup Tags</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {SETUP_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag('setup_tags', tag)}
                    style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', cursor:'pointer', border:'1px solid', borderColor: form.setup_tags.includes(tag) ? '#00d4aa' : '#30363d', background: form.setup_tags.includes(tag) ? '#0a2d26' : 'transparent', color: form.setup_tags.includes(tag) ? '#00d4aa' : '#8b949e' }}>
                    {tag}
                  </button>
                ))}
                {form.setup_tags.filter((t: string) => !SETUP_TAGS.includes(t)).map((tag: string) => (
                  <button key={tag} type="button" onClick={() => toggleTag('setup_tags', tag)}
                    style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', cursor:'pointer', border:'1px solid #00d4aa', background:'#0a2d26', color:'#00d4aa', display:'flex', alignItems:'center', gap:'5px' }}>
                    {tag} <span style={{ opacity:0.7 }}>✕</span>
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
                <input value={customSetup} onChange={e=>setCustomSetup(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addCustomTag('setup_tags', customSetup) } }}
                  placeholder="+ Add custom setup tag"
                  style={{ flex:1, padding:'6px 10px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'11px', outline:'none' }}/>
                <button type="button" onClick={()=>addCustomTag('setup_tags', customSetup)}
                  style={{ padding:'6px 14px', background:'#0a2d26', border:'1px solid #00d4aa', borderRadius:'7px', color:'#00d4aa', fontSize:'11px', cursor:'pointer' }}>Add</button>
              </div>
            </div>

            {/* Mistake Tags */}
            <div style={{ marginBottom:'12px' }}>
              <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'8px' }}>Mistake Tags</label>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {MISTAKE_TAGS.map(tag => (
                  <button key={tag} type="button" onClick={() => toggleTag('mistake_tags', tag)}
                    style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', cursor:'pointer', border:'1px solid', borderColor: form.mistake_tags.includes(tag) ? '#f85149' : '#30363d', background: form.mistake_tags.includes(tag) ? '#3d0f0f' : 'transparent', color: form.mistake_tags.includes(tag) ? '#f85149' : '#8b949e' }}>
                    {tag}
                  </button>
                ))}
                {form.mistake_tags.filter((t: string) => !MISTAKE_TAGS.includes(t)).map((tag: string) => (
                  <button key={tag} type="button" onClick={() => toggleTag('mistake_tags', tag)}
                    style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', cursor:'pointer', border:'1px solid #f85149', background:'#3d0f0f', color:'#f85149', display:'flex', alignItems:'center', gap:'5px' }}>
                    {tag} <span style={{ opacity:0.7 }}>✕</span>
                  </button>
                ))}
              </div>
              <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
                <input value={customMistake} onChange={e=>setCustomMistake(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); addCustomTag('mistake_tags', customMistake) } }}
                  placeholder="+ Add custom mistake tag"
                  style={{ flex:1, padding:'6px 10px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'7px', color:'#e6edf3', fontSize:'11px', outline:'none' }}/>
                <button type="button" onClick={()=>addCustomTag('mistake_tags', customMistake)}
                  style={{ padding:'6px 14px', background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'7px', color:'#f85149', fontSize:'11px', cursor:'pointer' }}>Add</button>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'12px', color:'#8b949e', marginBottom:'5px' }}>Notes</label>
              <textarea {...inp({ height:'80px', resize:'vertical' })} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} placeholder="What happened? What did you learn?" />
            </div>

            {error && <div style={{ background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'8px', padding:'10px 14px', color:'#f85149', fontSize:'13px', marginBottom:'12px' }}>{error}</div>}

            <div style={{ display:'flex', gap:'10px' }}>
              <button type="submit" disabled={saving} style={{ flex:1, padding:'10px', background: saving ? '#0a8a6e' : '#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Trade'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding:'10px 20px', background:'transparent', color:'#8b949e', border:'1px solid #30363d', borderRadius:'8px', fontSize:'13px', cursor:'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
        {[['all','All'],['wins','Wins ✅'],['losses','Losses ❌'],['stocks','Stocks'],['forex','Forex'],['crypto','Crypto']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            style={{ padding:'6px 12px', borderRadius:'20px', fontSize:'12px', cursor:'pointer', border:'1px solid', borderColor: filter===val ? '#00d4aa' : '#30363d', background: filter===val ? '#0a2d26' : 'transparent', color: filter===val ? '#00d4aa' : '#8b949e' }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:'12px', color:'#8b949e', alignSelf:'center' }}>{filtered.length} trades</span>
      </div>

      {/* Trades Table */}
      <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8b949e' }}>Loading trades...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center' }}>
            <div style={{ fontSize:'36px', marginBottom:'12px' }}>📓</div>
            <p style={{ color:'#8b949e', fontSize:'14px', margin:'0 0 16px' }}>No trades yet. Add your first trade!</p>
            <button onClick={() => setShowForm(true)} style={{ padding:'9px 18px', background:'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              + Add First Trade
            </button>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#0d1117' }}>
                {['Symbol','Dir','Market','Date','Entry','Exit','Qty','Net P&L','Tags',''].map(h => (
                  <th key={h} style={{ textAlign:'left', fontSize:'11px', color:'#8b949e', fontWeight:'500', padding:'10px 12px', borderBottom:'1px solid #21262d', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} style={{ borderBottom:'1px solid #21262d', borderLeft:`2px solid ${(t.net_pnl||0)>=0?'#3fb950':'#f85149'}` }}>
                  <td style={{ padding:'10px 12px', fontSize:'13px', fontWeight:'600', color:'#e6edf3' }}>{t.symbol}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <span style={{ background:t.direction==='long'?'#0f3d2e':'#3d0f0f', color:t.direction==='long'?'#3fb950':'#f85149', borderRadius:'4px', padding:'2px 8px', fontSize:'11px', fontWeight:'500' }}>{t.direction}</span>
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:'11px', color:'#8b949e', textTransform:'capitalize' }}>{t.market}</td>
                  <td style={{ padding:'10px 12px', fontSize:'12px', color:'#8b949e', whiteSpace:'nowrap' }}>{t.trade_date}</td>
                  <td style={{ padding:'10px 12px', fontSize:'12px', color:'#8b949e' }}>${parseFloat(t.entry_price).toFixed(4)}</td>
                  <td style={{ padding:'10px 12px', fontSize:'12px', color:'#8b949e' }}>{t.exit_price ? `$${parseFloat(t.exit_price).toFixed(4)}` : '—'}</td>
                  <td style={{ padding:'10px 12px', fontSize:'12px', color:'#8b949e' }}>{t.quantity}</td>
                  <td style={{ padding:'10px 12px', fontSize:'13px', fontWeight:'600', color:(t.net_pnl||0)>=0?'#3fb950':'#f85149', whiteSpace:'nowrap' }}>{fmt(t.net_pnl||0)}</td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                      {(t.setup_tags||[]).map((tag: string) => <span key={tag} style={{ background:'#0a2d26', color:'#00d4aa', borderRadius:'4px', padding:'1px 6px', fontSize:'10px' }}>{tag}</span>)}
                      {(t.mistake_tags||[]).map((tag: string) => <span key={tag} style={{ background:'#3d0f0f', color:'#f85149', borderRadius:'4px', padding:'1px 6px', fontSize:'10px' }}>{tag}</span>)}
                    </div>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:'2px', alignItems:'center' }}>
                      {t.status === 'open' && (
                        <button onClick={() => quickClose(t)} style={{ background:'#0a2d26', border:'1px solid #00d4aa', color:'#00d4aa', cursor:'pointer', fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'6px' }} title="Close trade">Close</button>
                      )}
                      <button onClick={() => openEdit(t)} style={{ background:'transparent', border:'none', color:'#8b949e', cursor:'pointer', fontSize:'14px', padding:'2px 6px' }} title="Edit">✏️</button>
                      <button onClick={() => deleteTrade(t.id)} style={{ background:'transparent', border:'none', color:'#8b949e', cursor:'pointer', fontSize:'14px', padding:'2px 6px' }} title="Delete">🗑</button>
                    </div>
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
