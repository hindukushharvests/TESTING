import { NextResponse } from 'next/server'

// Binance interval mapping
const BINANCE_IV: Record<string, string> = {
  '1m':'1m','3m':'3m','5m':'5m','15m':'15m','30m':'30m',
  '1h':'1h','2h':'2h','4h':'4h','6h':'6h','8h':'8h','12h':'12h',
  '1D':'1d','3D':'3d','1W':'1w','1M':'1M'
}

// Yahoo Finance interval + range mapping
const YAHOO_IV: Record<string, string> = {
  '1m':'1m','5m':'5m','15m':'15m','30m':'30m',
  '1h':'1h','4h':'1h','1D':'1d','1W':'1wk'
}
const YAHOO_RANGE: Record<string, string> = {
  '1m':'7d','5m':'60d','15m':'60d','30m':'60d',
  '1h':'2y','4h':'5y','1D':'5y','1W':'5y'
}

// Crypto symbols that go to Binance
const CRYPTO_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'DOGEUSDT','AVAXUSDT','DOTUSDT','MATICUSDT','LTCUSDT','LINKUSDT',
  'ATOMUSDT','UNIUSDT','NEARUSDT','APTUSDT','ARBUSDT','OPUSDT',
  'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','MATIC'
]

function isCrypto(symbol: string): boolean {
  const s = symbol.toUpperCase().replace('-','').replace('/','').replace('USDT','').replace('USD','')
  return CRYPTO_SYMBOLS.some(c => c.replace('USDT','') === s || c === symbol.toUpperCase())
}

// ── Fetch from Binance ─────────────────────────────────────────
async function fetchBinance(symbol: string, interval: string): Promise<any[]> {
  // Ensure symbol ends with USDT
  let sym = symbol.toUpperCase().replace('/','').replace('-','')
  if (!sym.endsWith('USDT') && !sym.endsWith('BUSD') && !sym.endsWith('BTC')) {
    sym = sym.replace('USD','') + 'USDT'
  }

  const iv = BINANCE_IV[interval] || '1d'
  const limit = 1000 // max per request
  
  // Fetch multiple batches to get 5 years of data
  const allCandles: any[] = []
  let endTime: number | undefined = undefined
  const fiveYearsAgo = Date.now() - 5 * 365 * 24 * 60 * 60 * 1000
  
  // For daily/weekly we need multiple requests for 5 years
  const batchCount = ['1D','1W','3D'].includes(interval) ? 5 : 2

  for (let batch = 0; batch < batchCount; batch++) {
    const url: string = endTime
      ? `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${iv}&limit=${limit}&endTime=${endTime}`
      : `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${iv}&limit=${limit}`

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    })

    if (!res.ok) break
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break

    // Binance returns: [openTime, open, high, low, close, volume, ...]
    const batch_candles = data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000),
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))

    allCandles.unshift(...batch_candles)
    endTime = data[0][0] - 1 // go further back
    if (data[0][0] <= fiveYearsAgo) break
    if (data.length < limit) break
  }

  // Sort by time ascending and remove duplicates
  const unique = allCandles
    .sort((a, b) => a.time - b.time)
    .filter((c, i, arr) => i === 0 || c.time !== arr[i-1].time)
    .filter(c => c.open > 0 && c.close > 0)

  return unique
}

// ── Fetch from Yahoo Finance ───────────────────────────────────
async function fetchYahoo(symbol: string, interval: string): Promise<any[]> {
  const iv    = YAHOO_IV[interval]    || '1d'
  const range = YAHOO_RANGE[interval] || '5y'

  // Clean symbol for Yahoo
  let sym = symbol.toUpperCase()
  const yahooMap: Record<string, string> = {
    'BTC': 'BTC-USD', 'ETH': 'ETH-USD', 'SOL': 'SOL-USD',
    'EUR/USD': 'EURUSD=X', 'GBP/USD': 'GBPUSD=X',
    'USD/JPY': 'USDJPY=X', 'AUD/USD': 'AUDUSD=X',
  }
  sym = yahooMap[sym] || sym

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${iv}&range=${range}&includePrePost=false`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    cache: 'no-store'
  })

  if (!res.ok) return []
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result?.timestamp) return []

  const q = result.indicators?.quote?.[0] || {}
  return result.timestamp
    .map((t: number, i: number) => ({
      time:   t,
      open:   +Number(q.open?.[i]   || 0).toFixed(4),
      high:   +Number(q.high?.[i]   || 0).toFixed(4),
      low:    +Number(q.low?.[i]    || 0).toFixed(4),
      close:  +Number(q.close?.[i]  || 0).toFixed(4),
      volume: +Number(q.volume?.[i] || 0),
    }))
    .filter((c: any) => c.open > 0 && c.close > 0)
}

// ── Main handler ───────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol   = searchParams.get('symbol')   || 'BTCUSDT'
    const interval = searchParams.get('interval') || '1D'

    let candles: any[] = []
    let source = ''

    if (isCrypto(symbol)) {
      // Try Binance first
      try {
        candles = await fetchBinance(symbol, interval)
        source  = 'binance'
      } catch (e) {
        console.error('Binance failed:', e)
      }
      // Fallback to Yahoo for crypto
      if (candles.length < 10) {
        candles = await fetchYahoo(symbol, interval)
        source  = 'yahoo-crypto'
      }
    } else {
      // Stocks/Forex → Yahoo Finance
      try {
        candles = await fetchYahoo(symbol, interval)
        source  = 'yahoo'
      } catch (e) {
        console.error('Yahoo failed:', e)
      }
    }

    console.log(`[Chart API] ${symbol} ${interval} → ${source} → ${candles.length} candles`)

    return NextResponse.json({
      candles,
      symbol,
      interval,
      source,
      count: candles.length
    })

  } catch (err) {
    console.error('Chart API error:', err)
    return NextResponse.json({ candles: [], error: String(err) })
  }
}
