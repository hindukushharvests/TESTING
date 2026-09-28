'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Broker detection and parsing (unchanged logic) ───────────────
const BROKERS = {
  mt4: {
    name: 'MetaTrader 4', logo: '📊', color: '#4a90d9',
    detect: (h: string[]) => h.some(x=>x.toLowerCase().includes('ticket')) && h.some(x=>x.toLowerCase().includes('profit')),
    parse: (row: any) => ({
      symbol: row['Symbol']||row['symbol']||'',
      direction: (row['Type']||'').toLowerCase().includes('buy')?'long':'short',
      entry_price: parseFloat(row['Open Price']||row['open_price']||'0'),
      exit_price: parseFloat(row['Close Price']||row['close_price']||'0'),
      quantity: parseFloat(row['Volume']||row['volume']||'0'),
      profit: parseFloat(row['Profit']||row['profit']||'0'),
      commission: parseFloat(row['Commission']||row['commission']||'0'),
      swap: parseFloat(row['Swap']||row['swap']||'0'),
      net_pnl: parseFloat(row['Profit']||'0')+parseFloat(row['Commission']||'0')+parseFloat(row['Swap']||'0'),
      open_time: row['Open Time']||row['open_time']||'', close_time: row['Close Time']||row['close_time']||'',
      trade_id: row['Ticket']||row['ticket']||'',
    }),
  },
  mt5: {
    name: 'MetaTrader 5', logo: '📈', color: '#5b9bd5',
    detect: (h: string[]) => h.some(x=>x.toLowerCase().includes('position')) && h.some(x=>x.toLowerCase().includes('profit')),
    parse: (row: any) => ({
      symbol: row['Symbol']||row['symbol']||'',
      direction: (row['Type']||'').toLowerCase().includes('buy')?'long':'short',
      entry_price: parseFloat(row['Price']||row['price']||'0'),
      exit_price: parseFloat(row['Close Price']||row['price_close']||'0'),
      quantity: parseFloat(row['Volume']||row['volume']||'0'),
      profit: parseFloat(row['Profit']||row['profit']||'0'),
      commission: parseFloat(row['Commission']||row['commission']||'0'),
      swap: parseFloat(row['Swap']||row['swap']||'0'),
      net_pnl: parseFloat(row['Profit']||'0')+parseFloat(row['Commission']||'0')+parseFloat(row['Swap']||'0'),
      open_time: row['Time']||row['time']||'', close_time: row['Close Time']||row['time_close']||'',
      trade_id: row['Position']||row['position']||'',
    }),
  },
  binance: {
    name: 'Binance', logo: '🔶', color: '#f0b90b',
    detect: (h: string[]) => h.some(x=>x.toLowerCase().includes('realized')) || h.some(x=>x.toLowerCase().includes('orderno')),
    parse: (row: any) => {
      const side = (row['Side']||row['side']||'').toLowerCase()
      const pnl = parseFloat(row['Realized Profit']||row['realizedProfit']||row['PNL']||'0')
      return {
        symbol: row['Symbol']||row['symbol']||row['Pair']||'',
        direction: side.includes('buy')?'long':'short',
        entry_price: parseFloat(row['Entry Price']||row['entryPrice']||row['AvgBuy']||'0'),
        exit_price: parseFloat(row['Exit Price']||row['exitPrice']||row['AvgSell']||'0'),
        quantity: parseFloat(row['Size']||row['size']||row['Qty']||'0'),
        profit: pnl, commission: parseFloat(row['Fee']||row['fee']||row['Commission']||'0'), swap: 0,
        net_pnl: pnl - parseFloat(row['Fee']||row['fee']||'0'),
        open_time: row['Open Time']||row['openTime']||row['Date']||'', close_time: row['Close Time']||row['closeTime']||row['Date']||'',
        trade_id: row['Order No.']||row['orderId']||row['Trade ID']||'',
      }
    },
  },
  bybit: {
    name: 'Bybit', logo: '🟡', color: '#f7a600',
    detect: (h: string[]) => h.some(x=>x.toLowerCase().includes('closedpnl')||x.toLowerCase().includes('closed pnl')),
    parse: (row: any) => ({
      symbol: row['Symbol']||row['symbol']||row['Contract']||'',
      direction: (row['Side']||row['side']||'').toLowerCase().includes('buy')?'long':'short',
      entry_price: parseFloat(row['Avg Entry Price']||row['entryPrice']||row['Entry Price']||'0'),
      exit_price: parseFloat(row['Avg Exit Price']||row['exitPrice']||row['Exit Price']||'0'),
      quantity: parseFloat(row['Qty']||row['qty']||row['Size']||'0'),
      profit: parseFloat(row['Closed P&L']||row['closedPnl']||row['Closed PNL']||'0'),
      commission: parseFloat(row['Trading Fee']||row['fee']||'0'),
      swap: parseFloat(row['Funding Fee']||'0'),
      net_pnl: parseFloat(row['Closed P&L']||row['closedPnl']||'0')-parseFloat(row['Trading Fee']||row['fee']||'0'),
      open_time: row['Open Time']||row['openTime']||row['Created Time']||'', close_time: row['Close Time']||row['closeTime']||row['Updated Time']||'',
      trade_id: row['Order ID']||row['orderId']||'',
    }),
  },
  ibkr: {
    name: 'Interactive Brokers', logo: '🏛️', color: '#d52b1e',
    detect: (h: string[]) => h.some(x=>x.toLowerCase().includes('ibcommission')||x.toLowerCase().includes('netcash')),
    parse: (row: any) => ({
      symbol: row['Symbol']||row['symbol']||row['Financial Instrument']||'',
      direction: parseFloat(row['Quantity']||'0')>0?'long':'short',
      entry_price: parseFloat(row['TradePrice']||row['T. Price']||row['Price']||'0'),
      exit_price: parseFloat(row['TradePrice']||row['T. Price']||'0'),
      quantity: Math.abs(parseFloat(row['Quantity']||row['Qty']||'0')),
      profit: parseFloat(row['FifoPnlRealized']||row['Realized P/L']||'0'),
      commission: parseFloat(row['IBCommission']||row['Comm/Fee']||'0'), swap: 0,
      net_pnl: parseFloat(row['FifoPnlRealized']||'0')+parseFloat(row['IBCommission']||'0'),
      open_time: row['DateTime']||row['Date/Time']||row['Date']||'', close_time: row['DateTime']||row['Date/Time']||row['Date']||'',
      trade_id: row['TransactionID']||row['Trade ID']||'',
    }),
  },
}

type BrokerKey = keyof typeof BROKERS

function parseCSV(text: string): any[] {
  const lines = text.trim().split('\n').filter(l=>l.trim())
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim())
  return lines.slice(1).map(line=>{
    const vals = line.split(',').map(v=>v.replace(/"/g,'').trim())
    const row: any = {}
    headers.forEach((h,i)=>{ row[h]=vals[i]||'' })
    return row
  })
}
function detectBroker(h: string[]): BrokerKey|null {
  for (const [k,b] of Object.entries(BROKERS)) if (b.detect(h)) return k as BrokerKey
  return null
}
function parseDate(str: string): string {
  if (!str) return new Date().toISOString().slice(0,10)
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0,10)
  const parts = str.split(/[.\-\/\s]/)
  if (parts.length>=3) { const a=new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); if(!isNaN(a.getTime())) return a.toISOString().slice(0,10) }
  return new Date().toISOString().slice(0,10)
}
const fmt = (v: number) => { const a=Math.abs(v).toFixed(2); return v>=0?`+$${a}`:`-$${a}` }

export default function ImportPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload'|'preview'|'importing'|'done'>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [rawRows, setRawRows] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [detectedBroker, setDetectedBroker] = useState<BrokerKey|null>(null)
  const [selectedBroker, setSelectedBroker] = useState<BrokerKey|null>(null)
  const [parsedTrades, setParsedTrades] = useState<any[]>([])
  const [importResult, setImportResult] = useState<{count:number;broker:string}|null>(null)
  const [imports, setImports] = useState<any[]>([])
  const [importedTrades, setImportedTrades] = useState<any[]>([])
  const [selectedImport, setSelectedImport] = useState<string|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(()=>{ fetchImports() },[])

  async function fetchImports() {
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('trade_imports').select('*').eq('user_id',user.id).order('imported_at',{ascending:false})
    setImports(data||[]); setLoading(false)
  }
  async function fetchImportedTrades(id: string) {
    const { data } = await supabase.from('imported_trades').select('*').eq('import_id',id).order('trade_date',{ascending:false})
    setImportedTrades(data||[]); setSelectedImport(id)
  }
  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) { setError('Please upload a CSV file'); return }
    setFileName(file.name); setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const rows = parseCSV(text)
      if (rows.length===0) { setError('CSV file appears to be empty'); return }
      const hdrs = Object.keys(rows[0])
      setHeaders(hdrs); setRawRows(rows)
      const detected = detectBroker(hdrs)
      setDetectedBroker(detected); setSelectedBroker(detected)
      if (detected) {
        const parsed = rows.map(row=>({ ...BROKERS[detected].parse(row), trade_date: parseDate(row['Open Time']||row['Date']||row['Time']||row['DateTime']||''), raw_data: row })).filter(t=>t.symbol && t.net_pnl!==undefined)
        setParsedTrades(parsed)
      }
      setStep('preview')
    }
    reader.readAsText(file)
  }
  function handleBrokerChange(broker: BrokerKey) {
    setSelectedBroker(broker)
    const parsed = rawRows.map(row=>({ ...BROKERS[broker].parse(row), trade_date: parseDate(row['Open Time']||row['Date']||row['Time']||row['DateTime']||''), raw_data: row })).filter(t=>t.symbol)
    setParsedTrades(parsed)
  }
  async function handleImport() {
    if (!selectedBroker || parsedTrades.length===0) return
    setStep('importing')
    const { data:{user} } = await supabase.auth.getUser()
    if (!user) return
    const { data: rec } = await supabase.from('trade_imports').insert({ user_id:user.id, broker:BROKERS[selectedBroker].name, file_name:fileName, trade_count:parsedTrades.length, status:'success' }).select().single()
    if (rec) {
      const rows = parsedTrades.map(t=>({ user_id:user.id, import_id:rec.id, broker:BROKERS[selectedBroker].name, symbol:t.symbol, trade_date:t.trade_date, open_time:t.open_time?new Date(t.open_time).toISOString():null, close_time:t.close_time?new Date(t.close_time).toISOString():null, direction:t.direction, entry_price:t.entry_price||null, exit_price:t.exit_price||null, quantity:t.quantity||null, profit:t.profit||0, commission:t.commission||0, swap:t.swap||0, net_pnl:t.net_pnl||0, trade_id:t.trade_id||null, raw_data:t.raw_data }))
      await supabase.from('imported_trades').insert(rows)
      // ALSO write to the 'trades' table so imported trades show on the dashboard/journal
      const tradeRows = parsedTrades.map(t=>({
        user_id: user.id,
        symbol: (t.symbol||'').toUpperCase(),
        trade_date: t.trade_date,
        trade_time: null,
        direction: t.direction || 'long',
        market: 'stocks',
        entry_price: t.entry_price || null,
        exit_price: t.exit_price || null,
        quantity: t.quantity || null,
        gross_pnl: t.profit || t.net_pnl || 0,
        fees: (t.commission||0) + (t.swap||0),
        net_pnl: t.net_pnl || 0,
        setup_tags: [],
        mistake_tags: [],
        notes: `Imported from ${BROKERS[selectedBroker].name}`,
        status: 'closed',
      }))
      await supabase.from('trades').insert(tradeRows)
      setImportResult({ count:parsedTrades.length, broker:BROKERS[selectedBroker].name })
      await fetchImports(); setStep('done')
    }
  }

  const totalPnl = importedTrades.reduce((s,t)=>s+(t.net_pnl||0),0)
  const wins = importedTrades.filter(t=>(t.net_pnl||0)>0)
  const STEPS = ['upload','preview','done']
  const stepIdx = step==='importing' ? 1 : STEPS.indexOf(step)

  return (
    <div style={{ maxWidth:'1100px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
        @keyframes slideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
        .slide-in{animation:slideIn .4s ease}
        .broker-card{transition:all .2s ease;cursor:pointer}
        .broker-card:hover{transform:translateY(-3px)}
      `}</style>

      {/* Header + step progress */}
      <div style={{ marginBottom:'24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'4px', flexWrap:'wrap', gap:'10px' }}>
          <div>
            <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px', letterSpacing:'-0.5px' }}>📥 Import Trades</h1>
            <p style={{ color:'#8b949e', fontSize:'13px', margin:'0 0 20px' }}>
              Import from MetaTrader, Binance, Bybit, Interactive Brokers and more — auto-detected.
            </p>
          </div>
          <button onClick={()=>window.location.href='/import/reports'}
            style={{ background:'linear-gradient(135deg,#00d4aa,#009980)', border:'none', borderRadius:'8px', padding:'10px 20px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
            📊 View Reports →
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px', maxWidth:'440px' }}>
          {['Upload','Preview','Done'].map((label,i)=>(
            <div key={label} style={{ display:'flex', alignItems:'center', flex: i<2?1:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div style={{
                  width:'26px', height:'26px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'12px', fontWeight:'700',
                  background: i<=stepIdx?'#00d4aa':'#21262d',
                  color: i<=stepIdx?'#0d1117':'#8b949e',
                  transition:'all .3s ease'
                }}>
                  {i<stepIdx ? '✓' : i+1}
                </div>
                <span style={{ fontSize:'12px', fontWeight: i===stepIdx?'600':'400', color: i<=stepIdx?'#e6edf3':'#8b949e' }}>{label}</span>
              </div>
              {i<2 && <div style={{ flex:1, height:'2px', background: i<stepIdx?'#00d4aa':'#21262d', margin:'0 10px', transition:'all .3s ease' }}/>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'16px' }}>
        <div>

          {/* STEP: UPLOAD */}
          {step==='upload' && (
            <div className="slide-in">
              {/* Broker cards */}
              <div style={{ marginBottom:'16px' }}>
                <div style={{ fontSize:'12px', color:'#8b949e', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Supported Brokers</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px' }}>
                  {Object.entries(BROKERS).map(([key,b])=>(
                    <div key={key} className="broker-card" style={{
                      background:'#161b22', border:`1px solid ${b.color}33`, borderRadius:'10px', padding:'14px 8px', textAlign:'center'
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=b.color+'88';e.currentTarget.style.boxShadow=`0 6px 20px ${b.color}22`}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=b.color+'33';e.currentTarget.style.boxShadow='none'}}>
                      <div style={{ fontSize:'24px', marginBottom:'6px' }}>{b.logo}</div>
                      <div style={{ fontSize:'10px', color:'#e6edf3', fontWeight:'600', lineHeight:'1.3' }}>{b.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drop zone — BIG and animated */}
              <div
                onDragOver={e=>{e.preventDefault();setDragging(true)}}
                onDragLeave={()=>setDragging(false)}
                onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
                onClick={()=>fileRef.current?.click()}
                style={{
                  position:'relative', overflow:'hidden',
                  border:`2px dashed ${dragging?'#00d4aa':'#30363d'}`,
                  borderRadius:'16px', padding:'56px 24px', textAlign:'center', cursor:'pointer',
                  background: dragging?'rgba(0,212,170,0.06)':'#161b22',
                  transition:'all .25s ease',
                }}>
                {/* Glow effect when dragging */}
                {dragging && <div style={{ position:'absolute', inset:0, background:'radial-gradient(circle at center, rgba(0,212,170,0.1), transparent 70%)', pointerEvents:'none' }}/>}
                <div style={{ fontSize:'52px', marginBottom:'16px', animation: dragging?'bounce .6s ease infinite':'float 3s ease-in-out infinite' }}>
                  {dragging ? '📥' : '📂'}
                </div>
                <div style={{ fontSize:'17px', fontWeight:'700', color:'#e6edf3', marginBottom:'6px' }}>
                  {dragging ? 'Drop it here!' : 'Drop your CSV file here'}
                </div>
                <div style={{ fontSize:'13px', color:'#8b949e', marginBottom:'20px' }}>or click to browse your files</div>
                <div className="shimmer" style={{ display:'inline-block', background:'linear-gradient(135deg,#00d4aa,#009980)', borderRadius:'10px', padding:'11px 28px', color:'#0d1117', fontSize:'14px', fontWeight:'700' }}>
                  Choose File
                </div>
                <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}}/>
              </div>

              {error && (
                <div style={{ marginTop:'12px', background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'10px', padding:'12px 16px', color:'#f85149', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px' }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Export instructions */}
              <div style={{ marginTop:'20px' }}>
                <div style={{ fontSize:'12px', color:'#8b949e', marginBottom:'10px', textTransform:'uppercase', letterSpacing:'0.5px' }}>How to export from your broker</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'10px' }}>
                  {[
                    { broker:'📊 MT4 / MT5', steps:'Account History → Right-click → Save as Detailed Report' },
                    { broker:'🔶 Binance', steps:'Orders → Trade History → Export → Download CSV' },
                    { broker:'🟡 Bybit', steps:'Assets → Order History → Closed P&L → Export' },
                    { broker:'🏛️ Interactive Brokers', steps:'Reports → Statements → Activity Statement → CSV' },
                  ].map(({broker,steps})=>(
                    <div key={broker} style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3', marginBottom:'5px' }}>{broker}</div>
                      <div style={{ fontSize:'11px', color:'#8b949e', lineHeight:'1.6' }}>{steps}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP: PREVIEW */}
          {step==='preview' && (
            <div className="slide-in" style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', overflow:'hidden' }}>
              <div style={{ padding:'18px 20px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'15px', fontWeight:'700', color:'#e6edf3' }}>Preview Import</div>
                  <div style={{ fontSize:'12px', color:'#8b949e', marginTop:'2px' }}>📄 {fileName} · {rawRows.length} rows</div>
                </div>
                <button onClick={()=>{setStep('upload');setParsedTrades([]);setFileName('')}}
                  style={{ background:'#21262d', border:'none', borderRadius:'8px', width:'30px', height:'30px', color:'#8b949e', cursor:'pointer', fontSize:'16px' }}>✕</button>
              </div>

              {/* Broker detection */}
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #21262d', display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
                {detectedBroker ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'10px', padding:'8px 14px' }}>
                    <span style={{ fontSize:'20px' }}>{BROKERS[detectedBroker].logo}</span>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'600', color:'#00d4aa' }}>{BROKERS[detectedBroker].name}</div>
                      <div style={{ fontSize:'10px', color:'#3fb950' }}>✓ Auto-detected</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background:'rgba(248,81,73,0.08)', border:'1px solid rgba(248,81,73,0.3)', borderRadius:'10px', padding:'10px 14px', fontSize:'12px', color:'#f85149' }}>
                    ⚠ Could not auto-detect — select broker manually →
                  </div>
                )}
                <div style={{ marginLeft:'auto' }}>
                  <div style={{ fontSize:'10px', color:'#8b949e', marginBottom:'4px' }}>Override broker</div>
                  <select value={selectedBroker||''} onChange={e=>handleBrokerChange(e.target.value as BrokerKey)}
                    style={{ background:'#0d1117', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'12px', padding:'7px 12px', outline:'none', cursor:'pointer' }}>
                    <option value="">Select broker...</option>
                    {Object.entries(BROKERS).map(([k,b])=><option key={k} value={k}>{b.logo} {b.name}</option>)}
                  </select>
                </div>
              </div>

              {parsedTrades.length>0 && (
                <>
                  {/* Stat cards */}
                  <div style={{ padding:'16px 20px', borderBottom:'1px solid #21262d', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
                    {[
                      { l:'Trades Found', v:parsedTrades.length, c:'#e6edf3', bg:'#0d1117' },
                      { l:'Total P&L', v:fmt(parsedTrades.reduce((s,t)=>s+(t.net_pnl||0),0)), c:parsedTrades.reduce((s,t)=>s+(t.net_pnl||0),0)>=0?'#3fb950':'#f85149', bg:parsedTrades.reduce((s,t)=>s+(t.net_pnl||0),0)>=0?'rgba(63,185,80,0.08)':'rgba(248,81,73,0.08)' },
                      { l:'Winners', v:parsedTrades.filter(t=>(t.net_pnl||0)>0).length, c:'#3fb950', bg:'rgba(63,185,80,0.08)' },
                      { l:'Losers', v:parsedTrades.filter(t=>(t.net_pnl||0)<=0).length, c:'#f85149', bg:'rgba(248,81,73,0.08)' },
                    ].map(s=>(
                      <div key={s.l} style={{ background:s.bg, borderRadius:'10px', padding:'12px 14px' }}>
                        <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'4px' }}>{s.l}</div>
                        <div style={{ fontSize:'18px', fontWeight:'700', color:s.c }}>{s.v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div style={{ overflowX:'auto', maxHeight:'320px', overflowY:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:'#0d1117', position:'sticky', top:0 }}>
                          {['Date','Symbol','Side','Entry','Exit','Qty','Net P&L'].map(h=>(
                            <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:'10px', color:'#8b949e', fontWeight:'600', textTransform:'uppercase', borderBottom:'1px solid #21262d', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedTrades.slice(0,50).map((t,i)=>(
                          <tr key={i} style={{ borderBottom:'1px solid #21262d' }}>
                            <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e', whiteSpace:'nowrap' }}>{t.trade_date}</td>
                            <td style={{ padding:'8px 14px', fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{t.symbol}</td>
                            <td style={{ padding:'8px 14px' }}>
                              <span style={{ background:t.direction==='long'?'#0f3d2e':'#3d0f0f', color:t.direction==='long'?'#3fb950':'#f85149', fontSize:'10px', padding:'2px 8px', borderRadius:'4px', fontWeight:'700', textTransform:'uppercase' }}>{t.direction}</span>
                            </td>
                            <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{t.entry_price?`$${Number(t.entry_price).toFixed(4)}`:'—'}</td>
                            <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{t.exit_price?`$${Number(t.exit_price).toFixed(4)}`:'—'}</td>
                            <td style={{ padding:'8px 14px', fontSize:'11px', color:'#8b949e' }}>{t.quantity||'—'}</td>
                            <td style={{ padding:'8px 14px', fontSize:'12px', fontWeight:'700', color:(t.net_pnl||0)>=0?'#3fb950':'#f85149', whiteSpace:'nowrap' }}>{fmt(t.net_pnl||0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedTrades.length>50 && <div style={{ padding:'10px', textAlign:'center', fontSize:'12px', color:'#8b949e' }}>Showing first 50 of {parsedTrades.length} trades</div>}
                  </div>

                  {/* Actions */}
                  <div style={{ padding:'16px 20px', borderTop:'1px solid #21262d', display:'flex', gap:'10px' }}>
                    <button onClick={handleImport} disabled={!selectedBroker}
                      style={{ flex:1, background:selectedBroker?'linear-gradient(135deg,#00d4aa,#009980)':'#21262d', border:'none', borderRadius:'10px', padding:'12px', color:selectedBroker?'#0d1117':'#8b949e', fontSize:'14px', fontWeight:'700', cursor:selectedBroker?'pointer':'not-allowed' }}>
                      Import {parsedTrades.length} Trades →
                    </button>
                    <button onClick={()=>{setStep('upload');setParsedTrades([]);setFileName('')}}
                      style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'10px', padding:'12px 20px', color:'#8b949e', fontSize:'13px', cursor:'pointer' }}>Cancel</button>
                  </div>
                </>
              )}

              {parsedTrades.length===0 && selectedBroker && (
                <div style={{ padding:'40px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>Could not parse trades with this format. Try another broker.</div>
              )}
            </div>
          )}

          {/* STEP: IMPORTING */}
          {step==='importing' && (
            <div className="slide-in" style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', padding:'64px', textAlign:'center' }}>
              <div style={{ width:'48px', height:'48px', border:'4px solid #21262d', borderTopColor:'#00d4aa', borderRadius:'50%', margin:'0 auto 20px', animation:'spin 0.8s linear infinite' }}/>
              <div style={{ fontSize:'16px', fontWeight:'700', color:'#e6edf3', marginBottom:'8px' }}>Importing trades...</div>
              <div style={{ fontSize:'13px', color:'#8b949e' }}>Saving {parsedTrades.length} trades to your account</div>
            </div>
          )}

          {/* STEP: DONE */}
          {step==='done' && importResult && (
            <div className="slide-in" style={{ background:'linear-gradient(135deg,rgba(0,212,170,0.08),#161b22)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'14px', padding:'48px', textAlign:'center' }}>
              <div style={{ fontSize:'56px', marginBottom:'16px', animation:'bounce 0.6s ease' }}>🎉</div>
              <div style={{ fontSize:'22px', fontWeight:'800', color:'#3fb950', marginBottom:'8px' }}>Import Successful!</div>
              <div style={{ fontSize:'14px', color:'#8b949e', marginBottom:'28px' }}>{importResult.count} trades imported from {importResult.broker}</div>
              <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
                <button onClick={()=>{setStep('upload');setParsedTrades([]);setFileName('');setImportResult(null)}}
                  style={{ background:'linear-gradient(135deg,#00d4aa,#009980)', border:'none', borderRadius:'10px', padding:'12px 28px', color:'#0d1117', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>Import Another</button>
                <button onClick={()=>fetchImportedTrades(imports[0]?.id)}
                  style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'10px', padding:'12px 28px', color:'#e6edf3', fontSize:'13px', cursor:'pointer' }}>View Trades</button>
              </div>
            </div>
          )}

          {/* Imported trades viewer */}
          {selectedImport && importedTrades.length>0 && (
            <div className="slide-in" style={{ marginTop:'16px', background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', overflow:'hidden' }}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #21262d', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Imported Trades · {importedTrades.length}</div>
                <div style={{ display:'flex', gap:'16px', alignItems:'center', fontSize:'12px' }}>
                  <span style={{ color:totalPnl>=0?'#3fb950':'#f85149', fontWeight:'700' }}>{fmt(totalPnl)}</span>
                  <span style={{ color:'#8b949e' }}>{wins.length}W / {importedTrades.length-wins.length}L</span>
                  <button onClick={()=>{setSelectedImport(null);setImportedTrades([])}} style={{ background:'#21262d', border:'none', borderRadius:'6px', width:'26px', height:'26px', color:'#8b949e', cursor:'pointer' }}>✕</button>
                </div>
              </div>
              <div style={{ overflowX:'auto', maxHeight:'400px', overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#0d1117', position:'sticky', top:0 }}>
                      {['#','Date','Symbol','Side','Entry','Exit','Net P&L'].map(h=>(
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', fontSize:'10px', color:'#8b949e', fontWeight:'600', textTransform:'uppercase', borderBottom:'1px solid #21262d', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importedTrades.map((t,i)=>(
                      <tr key={t.id} style={{ borderBottom:'1px solid #21262d', borderLeft:`2px solid ${(t.net_pnl||0)>=0?'#3fb950':'#f85149'}` }}>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:'#8b949e' }}>{i+1}</td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:'#8b949e', whiteSpace:'nowrap' }}>{t.trade_date}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{t.symbol}</td>
                        <td style={{ padding:'8px 12px' }}>
                          <span style={{ background:t.direction==='long'?'#0f3d2e':'#3d0f0f', color:t.direction==='long'?'#3fb950':'#f85149', fontSize:'10px', padding:'2px 7px', borderRadius:'4px', fontWeight:'700', textTransform:'uppercase' }}>{t.direction}</span>
                        </td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:'#8b949e' }}>{t.entry_price?`$${Number(t.entry_price).toFixed(2)}`:'—'}</td>
                        <td style={{ padding:'8px 12px', fontSize:'11px', color:'#8b949e' }}>{t.exit_price?`$${Number(t.exit_price).toFixed(2)}`:'—'}</td>
                        <td style={{ padding:'8px 12px', fontSize:'12px', fontWeight:'700', color:(t.net_pnl||0)>=0?'#3fb950':'#f85149', whiteSpace:'nowrap' }}>{fmt(t.net_pnl||0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right — Import history */}
        <div>
          <div style={{ background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', overflow:'hidden' }}>
            <div style={{ padding:'16px', borderBottom:'1px solid #21262d' }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3' }}>Import History</div>
              <div style={{ fontSize:'11px', color:'#8b949e', marginTop:'2px' }}>{imports.length} imports total</div>
            </div>
            {loading ? (
              <div style={{ padding:'32px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>Loading...</div>
            ) : imports.length===0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px', opacity:0.5 }}>📭</div>
                No imports yet.<br/>Upload your first CSV.
              </div>
            ) : (
              <div style={{ maxHeight:'600px', overflowY:'auto' }}>
                {imports.map(imp=>(
                  <div key={imp.id} onClick={()=>fetchImportedTrades(imp.id)}
                    style={{ padding:'14px 16px', borderBottom:'1px solid #21262d', cursor:'pointer', background:selectedImport===imp.id?'rgba(0,212,170,0.05)':'transparent', borderLeft:`2px solid ${selectedImport===imp.id?'#00d4aa':'transparent'}`, transition:'all .15s' }}
                    onMouseEnter={e=>{if(selectedImport!==imp.id)e.currentTarget.style.background='#0d1117'}}
                    onMouseLeave={e=>{if(selectedImport!==imp.id)e.currentTarget.style.background='transparent'}}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{imp.broker}</div>
                      <span style={{ background:'rgba(63,185,80,0.1)', color:'#3fb950', fontSize:'9px', padding:'2px 7px', borderRadius:'10px', fontWeight:'600' }}>{imp.status}</span>
                    </div>
                    <div style={{ fontSize:'11px', color:'#8b949e', marginBottom:'6px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>📄 {imp.file_name}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px' }}>
                      <span style={{ color:'#00d4aa', fontWeight:'600' }}>{imp.trade_count} trades</span>
                      <span style={{ color:'#8b949e' }}>{new Date(imp.imported_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
