'use client'

import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────
interface BTTrade {
  id: string
  direction: 'long' | 'short'
  entry_price: number
  exit_price: number
  stop_loss: number
  take_profit: number
  quantity: number
  fees: number
  net_pnl: number
  r_multiple: number
  setup_tags: string
  emotion: string
  strategy: string
  notes: string
  trade_date: string
  symbol: string
  market: string
}

// ── Constants ──────────────────────────────────────────────────
const CRYPTO = ['BINANCE:BTCUSDT','BINANCE:ETHUSDT','BINANCE:SOLUSDT','BINANCE:BNBUSDT','BINANCE:XRPUSDT','BINANCE:ADAUSDT','BINANCE:DOGEUSDT','BINANCE:AVAXUSDT','BINANCE:DOTUSDT','BINANCE:LINKUSDT']
const STOCKS = ['NASDAQ:AAPL','NASDAQ:TSLA','NASDAQ:NVDA','AMEX:SPY','NASDAQ:QQQ','NASDAQ:MSFT','NASDAQ:AMD','NASDAQ:AMZN','NASDAQ:META','NASDAQ:GOOGL']
const FOREX  = ['FX:EURUSD','FX:GBPUSD','FX:USDJPY','FX:AUDUSD','FX:USDCAD','FX:NZDUSD']
const TF_MAP: Record<string,string> = {'1m':'1','3m':'3','5m':'5','15m':'15','30m':'30','1h':'60','2h':'120','4h':'240','1D':'D','1W':'W'}
const EMOTIONS = ['Calm', 'Confident', 'Patient', 'FOMO', 'Anxious', 'Revenge', 'Greedy', 'Hesitant']
const RR_PRESETS = [1, 2, 3]

const T = {
  bg: '#0d1117', panel: '#161b22', border: '#21262d',
  text: '#e6edf3', dim: '#8b949e', teal: '#2dd4bf', gold: '#d4af37',
  up: '#26a69a', down: '#ef5350',
}
const fmt = (v: number) => { const a = Math.abs(v).toFixed(2); return v >= 0 ? `+$${a}` : `-$${a}` }

export default function BacktestSessionPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const sessionId = params.id as string
  const tvRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<any>(null)

  const { canBacktest } = useSubscription()

  const [session, setSession] = useState<any>(null)
  const [symbol, setSymbol] = useState('BINANCE:BTCUSDT')
  const [tf, setTf] = useState('4h')
  const [market, setMarket] = useState<'crypto'|'stocks'|'forex'>('crypto')
  const [startBal, setStartBal] = useState(10000)
  const [symbolReady, setSymbolReady] = useState(false)

  const [trades, setTrades] = useState<BTTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Auto-fill state
  const [riskMode, setRiskMode] = useState<'price'|'percent'>('price')
  const [riskValue, setRiskValue] = useState('')

  const blankForm = {
    direction: 'long' as 'long'|'short',
    entry_price: '', exit_price: '', stop_loss: '', take_profit: '',
    quantity: '1', fees: '0', setup_tags: '', emotion: '', strategy: '', notes: '',
    trade_date: new Date().toISOString().slice(0, 10),
  }
  const [form, setForm] = useState(blankForm)

  // ── Load session + trades ───────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: s } = await supabase.from('backtest_sessions').select('*').eq('id', sessionId).single()
      if (s) {
        setSession(s)
        const sym = s.symbol || 'BTCUSDT'
        if (sym.includes('USD') && !sym.includes('USDT')) {
          setMarket('forex'); setSymbol(`FX:${sym.replace('/','').replace('_','')}`)
        } else if (['AAPL','TSLA','NVDA','SPY','QQQ','MSFT','AMD','AMZN','META','GOOGL'].some(x=>sym.includes(x))) {
          setMarket('stocks'); setSymbol(`NASDAQ:${sym}`)
        } else {
          setMarket('crypto'); setSymbol(`BINANCE:${sym.includes('USDT')?sym:sym+'USDT'}`)
        }
        setTf(s.timeframe || '4h')
        if (s.starting_capital) setStartBal(+s.starting_capital)
      }
      setSymbolReady(true)  // signal that symbol is resolved → safe to build chart
      const { data: t } = await supabase
        .from('backtest_trades').select('*')
        .eq('session_id', sessionId).order('trade_date', { ascending: true })
      if (t) setTrades(t as BTTrade[])
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // ── Build TradingView widget — FIRST-LOAD FIX ───────────────
  // Wait until symbol is resolved (symbolReady), reuse the already-loaded
  // tv.js script instead of re-appending it, and retry until TradingView
  // is available. Depends on [symbol, symbolReady] — NOT tf — so timeframe
  // changes via the chart's own toolbar don't rebuild it / reset indicators.
  useEffect(() => {
    if (!symbolReady || !tvRef.current) return
    let cancelled = false

    function buildWidget() {
      if (cancelled || !tvRef.current) return
      const TV = (window as any).TradingView
      if (!TV || !TV.widget) {
        // script not ready yet — retry shortly
        setTimeout(buildWidget, 120)
        return
      }
      tvRef.current.innerHTML = ''
      widgetRef.current = new TV.widget({
        container_id: 'tv_chart_container',
        autosize: true,
        symbol,
        interval: TF_MAP[tf] || '240',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#161b22',
        enable_publishing: false,
        allow_symbol_change: true,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        hide_legend: false,
        withdateranges: true,
        save_image: true,
        show_popup_button: false,
        backgroundColor: '#0d1117',
        gridColor: 'rgba(33,38,45,0.8)',
      })
    }

    // Load tv.js once; if already present, just build
    const existing = document.getElementById('tv-script') as HTMLScriptElement | null
    if (existing && (window as any).TradingView) {
      buildWidget()
    } else if (existing) {
      existing.addEventListener('load', buildWidget, { once: true })
    } else {
      const script = document.createElement('script')
      script.id = 'tv-script'
      script.src = 'https://s3.tradingview.com/tv.js'
      script.async = true
      script.onload = buildWidget
      document.body.appendChild(script)
    }

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, symbolReady])

  // ── Stats ────────────────────────────────────────────────────
  const closed = trades.filter(t => t.net_pnl !== null && t.net_pnl !== undefined)
  const wins = closed.filter(t => t.net_pnl > 0)
  const losses = closed.filter(t => t.net_pnl < 0)
  const netPnl = closed.reduce((a, t) => a + (t.net_pnl || 0), 0)
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0
  const grossWin = wins.reduce((a, t) => a + t.net_pnl, 0)
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.net_pnl, 0))
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss
  const avgR = closed.length ? closed.reduce((a, t) => a + (t.r_multiple || 0), 0) / closed.length : 0
  const balance = startBal + netPnl

  // ── Auto-fill SL/TP ──────────────────────────────────────────
  function applyAutoFill(ratio: number) {
    const entry = parseFloat(form.entry_price)
    const rv = parseFloat(riskValue)
    if (!entry || !rv) { alert('Enter an entry price and a risk value first.'); return }
    const riskDist = riskMode === 'percent' ? entry * (rv / 100) : rv
    let sl: number, tp: number
    if (form.direction === 'long') {
      sl = entry - riskDist
      tp = entry + riskDist * ratio
    } else {
      sl = entry + riskDist
      tp = entry - riskDist * ratio
    }
    const dp = entry < 10 ? 5 : entry < 1000 ? 2 : 2
    setForm(f => ({ ...f, stop_loss: sl.toFixed(dp), take_profit: tp.toFixed(dp) }))
  }

  function calcR(): number {
    const entry = parseFloat(form.entry_price)
    const exit = parseFloat(form.exit_price)
    const sl = parseFloat(form.stop_loss)
    if (!entry || !exit || !sl) return 0
    const risk = Math.abs(entry - sl)
    if (risk === 0) return 0
    const reward = form.direction === 'long' ? exit - entry : entry - exit
    return reward / risk
  }
  function calcPnl(): number {
    const entry = parseFloat(form.entry_price)
    const exit = parseFloat(form.exit_price)
    const qty = parseFloat(form.quantity) || 1
    const fees = parseFloat(form.fees) || 0
    if (!entry || !exit) return 0
    const gross = (form.direction === 'long' ? exit - entry : entry - exit) * qty
    return gross - fees
  }

  // ── Save ─────────────────────────────────────────────────────
  async function saveTrade() {
    const entry = parseFloat(form.entry_price)
    const exit = parseFloat(form.exit_price)
    if (!entry || !exit) { alert('Entry and exit price are required.'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); alert('Not signed in.'); return }

    const r = calcR()
    const pnl = calcPnl()
    const row = {
      user_id: user.id,
      session_id: sessionId,
      symbol: symbol.split(':')[1] || symbol,
      market,
      trade_date: form.trade_date,
      direction: form.direction,
      entry_price: entry,
      exit_price: exit,
      stop_loss: parseFloat(form.stop_loss) || null,
      take_profit: parseFloat(form.take_profit) || null,
      quantity: parseFloat(form.quantity) || 1,
      fees: parseFloat(form.fees) || 0,
      gross_pnl: pnl + (parseFloat(form.fees) || 0),
      net_pnl: pnl,
      r_multiple: isFinite(r) ? r : 0,
      setup_tags: form.setup_tags || null,
      emotion: form.emotion || null,
      strategy: form.strategy || null,
      notes: form.notes || null,
      status: 'closed',
    }

    const { error } = editingId
      ? await supabase.from('backtest_trades').update(row).eq('id', editingId)
      : await supabase.from('backtest_trades').insert(row)
    if (error) { alert('Save failed: ' + error.message); setSaving(false); return }

    const { data: t } = await supabase.from('backtest_trades').select('*')
      .eq('session_id', sessionId).order('trade_date', { ascending: true })
    if (t) setTrades(t as BTTrade[])
    setForm(blankForm); setRiskValue(''); setEditingId(null); setSaving(false)
  }

  function editTrade(t: BTTrade) {
    setEditingId(t.id)
    setForm({
      direction: t.direction,
      entry_price: String(t.entry_price ?? ''),
      exit_price: String(t.exit_price ?? ''),
      stop_loss: String(t.stop_loss ?? ''),
      take_profit: String(t.take_profit ?? ''),
      quantity: String(t.quantity ?? '1'),
      fees: String(t.fees ?? '0'),
      setup_tags: t.setup_tags ?? '',
      emotion: t.emotion ?? '',
      strategy: t.strategy ?? '',
      notes: t.notes ?? '',
      trade_date: t.trade_date ?? new Date().toISOString().slice(0, 10),
    })
  }

  async function deleteTrade(id: string) {
    if (!confirm('Delete this trade?')) return
    await supabase.from('backtest_trades').delete().eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  const symbolList = market === 'crypto' ? CRYPTO : market === 'stocks' ? STOCKS : FOREX
  if (canBacktest === false) {
    return <UpgradeWall feature="Backtesting" description="Test your strategies on real market data. Upgrade to Pro to unlock." requiredTier="pro" />
  }
  const rPreview = calcR()
  const pnlPreview = calcPnl()

  return (
    <div style={{ padding: 12, color: T.text, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => router.push('/backtest/sessions')} style={btnGhost}>← Sessions</button>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{session?.name || 'Backtest Session'}</h1>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} style={sel}>
          {symbolList.map(s => <option key={s} value={s}>{s.split(':')[1]}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['crypto','stocks','forex'] as const).map(m => (
            <button key={m} onClick={() => { setMarket(m); const list = m==='crypto'?CRYPTO:m==='stocks'?STOCKS:FOREX; setSymbol(list[0]) }}
              style={{ ...tfBtn, background: market===m?T.teal:T.panel, color: market===m?T.bg:T.dim, borderColor: market===m?T.teal:T.border }}>
              {m}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: T.dim }}>Change timeframe in the chart toolbar — indicators persist.</span>
      </div>

      {/* Manual backtesting instructions */}
      <details style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: T.teal, fontWeight: 600 }}>📘 How to backtest manually (click to expand)</summary>
        <ol style={{ fontSize: 12, color: T.dim, lineHeight: 1.7, marginTop: 10, paddingLeft: 18 }}>
          <li>Pick your symbol and set the timeframe <b>in the chart's own toolbar</b> (top of chart) — this keeps your indicators from resetting.</li>
          <li>Use the chart's date-range scrubbing and drawing tools to find a setup at a past point in time.</li>
          <li>When you spot an entry, read the price off the chart and type it into the panel's <b>Entry</b> field.</li>
          <li>Enter your risk, then click <b>1:1 / 1:2 / 1:3</b> to auto-fill Stop Loss &amp; Take Profit (direction-aware).</li>
          <li>Fast-forward the chart to where you'd have exited, read that price, and type it into <b>Exit</b>.</li>
          <li>Tag the trade with a <b>Strategy</b> name, setup tags and emotion, then <b>Log Trade</b>.</li>
          <li>Your stats update live, and each strategy's performance shows on the main Dashboard.</li>
        </ol>
        <p style={{ fontSize: 12, color: T.gold, marginTop: 8, marginBottom: 0 }}>
          ⚠️ If the chart doesn't load, switch to another market (crypto / stocks / forex) and switch back — that forces it to reload.
        </p>
      </details>

      {/* Two-column: chart left, panel right */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* LEFT: chart + stats */}
        <div style={{ flex: '1 1 600px', minWidth: 320 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <Stat label="Balance" value={`$${balance.toFixed(2)}`} color={balance>=startBal?T.up:T.down} />
            <Stat label="Net P&L" value={fmt(netPnl)} color={netPnl>=0?T.up:T.down} />
            <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} color={T.text} />
            <Stat label="Profit Factor" value={profitFactor===Infinity?'∞':profitFactor.toFixed(2)} color={profitFactor>=1?T.up:T.down} />
            <Stat label="Avg R" value={avgR.toFixed(2)} color={avgR>=0?T.up:T.down} />
            <Stat label="Trades" value={String(closed.length)} color={T.text} />
          </div>
          <div ref={tvRef} id="tv_chart_container"
            style={{ width: '100%', height: 600, border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }} />
        </div>

        {/* RIGHT: panel */}
        <div style={{ flex: '0 0 360px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Logging form */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h2 style={{ fontSize: 14, margin: 0 }}>{editingId ? 'Edit Trade' : 'Log Trade'}</h2>
              {editingId && <button onClick={() => { setForm(blankForm); setEditingId(null) }} style={btnGhost}>Cancel</button>}
            </div>

            {/* Direction */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button onClick={() => setForm({...form, direction:'long'})}
                style={{ ...tfBtn, flex:1, background: form.direction==='long'?T.up:T.bg, color: form.direction==='long'?'#fff':T.dim, borderColor: form.direction==='long'?T.up:T.border }}>▲ Long</button>
              <button onClick={() => setForm({...form, direction:'short'})}
                style={{ ...tfBtn, flex:1, background: form.direction==='short'?T.down:T.bg, color: form.direction==='short'?'#fff':T.dim, borderColor: form.direction==='short'?T.down:T.border }}>▼ Short</button>
            </div>

            {/* Auto-fill strip */}
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6, padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Auto-fill SL / TP</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input type="number" value={form.entry_price} onChange={e=>setForm({...form, entry_price:e.target.value})} placeholder="Entry" style={{ ...inp, flex: 1 }} />
                <input type="number" value={riskValue} onChange={e=>setRiskValue(e.target.value)} placeholder={riskMode==='price'?'Risk (price)':'Risk (%)'} style={{ ...inp, flex: 1 }} />
                <button onClick={()=>setRiskMode(riskMode==='price'?'percent':'price')} style={{ ...tfBtn, padding:'4px 8px', fontSize: 11 }}>{riskMode==='price'?'$':'%'}</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {RR_PRESETS.map(r => (
                  <button key={r} onClick={()=>applyAutoFill(r)} style={{ ...tfBtn, flex:1, fontSize: 11, background: T.panel, color: T.teal, borderColor: T.teal }}>1:{r}</button>
                ))}
              </div>
            </div>

            {/* Prices */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <Field label="Entry" v={form.entry_price} onChange={v=>setForm({...form, entry_price:v})} />
              <Field label="Exit" v={form.exit_price} onChange={v=>setForm({...form, exit_price:v})} />
              <Field label="Stop Loss" v={form.stop_loss} onChange={v=>setForm({...form, stop_loss:v})} />
              <Field label="Take Profit" v={form.take_profit} onChange={v=>setForm({...form, take_profit:v})} />
              <Field label="Size / Qty" v={form.quantity} onChange={v=>setForm({...form, quantity:v})} />
              <Field label="Fees" v={form.fees} onChange={v=>setForm({...form, fees:v})} />
            </div>

            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: T.dim, marginBottom: 10 }}>
              <span>R: <b style={{ color: rPreview>=0?T.up:T.down }}>{rPreview.toFixed(2)}R</b></span>
              <span>Est P&L: <b style={{ color: pnlPreview>=0?T.up:T.down }}>{fmt(pnlPreview)}</b></span>
            </div>

            {/* Qualitative */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <Field label="Strategy" v={form.strategy} onChange={v=>setForm({...form, strategy:v})} placeholder="Breakout" type="text" />
              <Field label="Setup Tags" v={form.setup_tags} onChange={v=>setForm({...form, setup_tags:v})} placeholder="comma,sep" type="text" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={lbl}>Emotion</label>
                <select value={form.emotion} onChange={e=>setForm({...form, emotion:e.target.value})} style={inp}>
                  <option value="">—</option>
                  {EMOTIONS.map(em => <option key={em} value={em}>{em}</option>)}
                </select>
              </div>
              <Field label="Date" v={form.trade_date} onChange={v=>setForm({...form, trade_date:v})} type="date" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Notes</label>
              <textarea value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>

            <button onClick={saveTrade} disabled={saving}
              style={{ ...tfBtn, width: '100%', padding: '9px', background: T.teal, color: T.bg, fontWeight: 600, borderColor: T.teal, opacity: saving?0.6:1 }}>
              {saving ? 'Saving…' : editingId ? 'Update Trade' : 'Log Trade'}
            </button>
          </div>

          {/* Trade list */}
          <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14 }}>
            <h2 style={{ fontSize: 14, margin: '0 0 10px' }}>Trades ({trades.length})</h2>
            {loading ? <p style={{ color: T.dim, fontSize: 12 }}>Loading…</p> :
              trades.length === 0 ? <p style={{ color: T.dim, fontSize: 12 }}>No trades yet. Analyze on the chart, then log.</p> :
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto' }}>
                {trades.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: T.bg, borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: t.direction==='long'?T.up:T.down }}>{t.direction==='long'?'▲':'▼'}</span>
                    <span style={{ color: T.dim }}>{t.trade_date?.slice(5)}</span>
                    <span>{t.entry_price}→{t.exit_price}</span>
                    <span style={{ color: (t.r_multiple||0)>=0?T.up:T.down }}>{(t.r_multiple||0).toFixed(1)}R</span>
                    <span style={{ marginLeft: 'auto', color: (t.net_pnl||0)>=0?T.up:T.down, fontWeight: 600 }}>{fmt(t.net_pnl||0)}</span>
                    <button onClick={()=>editTrade(t)} style={miniBtn}>✎</button>
                    <button onClick={()=>deleteTrade(t.id)} style={{...miniBtn, color:T.down}}>✕</button>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: '6px 12px', minWidth: 78 }}>
      <div style={{ fontSize: 9, color: '#8b949e', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color }}>{value}</div>
    </div>
  )
}

function Field({ label, v, onChange, placeholder, type = 'number' }:
  { label: string; v: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={v} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inp} />
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 9, color: '#8b949e', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 }
const inp: React.CSSProperties = { width: '100%', background: '#0d1117', color: '#e6edf3', border: '1px solid #21262d', borderRadius: 6, padding: '6px 8px', fontSize: 12, boxSizing: 'border-box' }
const sel: React.CSSProperties = { background: '#161b22', color: '#e6edf3', border: '1px solid #21262d', borderRadius: 6, padding: '6px 10px', fontSize: 13 }
const tfBtn: React.CSSProperties = { border: '1px solid', borderRadius: 6, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { background: 'transparent', color: '#8b949e', border: '1px solid #21262d', borderRadius: 6, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }
const miniBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, padding: '1px 3px' }
