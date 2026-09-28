import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || new Date().toISOString().split('T')[0]
  const to   = searchParams.get('to')   || new Date(Date.now() + 7*86400000).toISOString().split('T')[0]

  // Try TradingEconomics free scrape via AllOrigins proxy
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(`https://tradingeconomics.com/calendar`)}`,
      { cache: 'no-store' }
    )
    // This approach is unreliable, use FMP instead
  } catch {}

  // Try FMP with your key
  try {
    const FMP_KEY = process.env.FMP_API_KEY
    if (FMP_KEY && FMP_KEY !== 'demo') {
      const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${FMP_KEY}`
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map((e: any, i: number) => ({
            id:       `${e.date}-${i}`,
            event:    e.event || 'Unknown',
            date:     (e.date || '').split(' ')[0],
            time:     (e.date || '').split(' ')[1]?.slice(0,5) || '12:00',
            country:  e.country || 'Unknown',
            currency: e.currency || 'USD',
            impact:   e.impact === 'High' ? 'high' : e.impact === 'Medium' ? 'medium' : 'low',
            actual:   e.actual   != null ? String(e.actual)   : null,
            forecast: e.estimate != null ? String(e.estimate) : null,
            previous: e.previous != null ? String(e.previous) : null,
          }))
          return NextResponse.json({ events: mapped, source: '🟢 FMP Live Data' })
        }
      }
    }
  } catch {}

  // Try Forex Factory RSS (free, no key, real data)
  try {
    const res = await fetch(
      'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
      { cache: 'no-store' }
    )
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data
          .filter((e: any) => {
            const d = e.date?.split('T')[0]
            return d >= from && d <= to
          })
          .map((e: any, i: number) => ({
            id:       `ff-${i}-${e.title}`,
            event:    e.title || 'Unknown',
            date:     e.date?.split('T')[0] || from,
            time:     e.date?.split('T')[1]?.slice(0,5) || '00:00',
            country:  e.country || 'Unknown',
            currency: e.currency || 'USD',
            impact:   e.impact === 'High' ? 'high' : e.impact === 'Medium' ? 'medium' : 'low',
            actual:   e.actual   || null,
            forecast: e.forecast || null,
            previous: e.previous || null,
          }))
        if (mapped.length > 0) {
          return NextResponse.json({ events: mapped, source: '🟢 Forex Factory Live' })
        }
      }
    }
  } catch {}

  // Fallback to generated events
  const events = generateEventsForWeek(from, to)
  return NextResponse.json({ events, source: '📋 Scheduled (no live source available)' })
}

function getDays(from: string, to: string): string[] {
  const days: string[] = []
  const cur = new Date(from + 'T00:00:00')
  const end = new Date(to   + 'T00:00:00')
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

function mk(date:string, time:string, event:string, currency:string, country:string, impact:string, forecast:string|null, previous:string|null) {
  return { id:`${date}-${event.replace(/\s+/g,'-').toLowerCase()}`, event, date, time, country, currency, impact, actual:null, forecast, previous }
}

function generateEventsForWeek(from: string, to: string) {
  const events: any[] = []
  getDays(from, to).forEach(date => {
    const d = new Date(date + 'T00:00:00')
    const dow = d.getDay(), day = d.getDate(), mon = d.getMonth()
    if(dow===1){events.push(mk(date,'09:00','Eurozone Manufacturing PMI','EUR','Eurozone','medium','48.5','47.8'));events.push(mk(date,'14:00','US ISM Manufacturing PMI','USD','United States','high','48.8','48.7'))}
    if(dow===2){events.push(mk(date,'12:30','US JOLTS Job Openings','USD','United States','medium','7.5M','7.6M'));events.push(mk(date,'14:00','US CB Consumer Confidence','USD','United States','medium','100.0','97.0'))}
    if(dow===3){events.push(mk(date,'12:30','US ADP Non-Farm Employment','USD','United States','high','180K','155K'));events.push(mk(date,'14:00','US ISM Services PMI','USD','United States','high','51.0','50.8'));events.push(mk(date,'14:30','US EIA Crude Oil Inventories','USD','United States','medium','-1.2M','-4.5M'))}
    if(dow===4){events.push(mk(date,'12:30','US Initial Jobless Claims','USD','United States','medium','222K','228K'))}
    if(dow===5){
      if(day<=7){events.push(mk(date,'12:30','US Non-Farm Payrolls','USD','United States','high','180K','177K'));events.push(mk(date,'12:30','US Unemployment Rate','USD','United States','high','4.2%','4.2%'))}
      if((day>=8&&day<=14)||(day>=22&&day<=28))events.push(mk(date,'14:00','Michigan Consumer Sentiment','USD','United States','medium','57.5','52.2'))
      if(day>=25)events.push(mk(date,'16:00','Bitcoin CME Futures Settlement','BTC','CME','high',null,null))
    }
    if(dow===3&&day>=8&&day<=14){events.push(mk(date,'12:30','US CPI YoY','USD','United States','high','2.3%','2.4%'));events.push(mk(date,'12:30','US Core CPI MoM','USD','United States','high','0.3%','0.3%'))}
    if(dow===4&&day>=9&&day<=15)events.push(mk(date,'12:30','US PPI MoM','USD','United States','medium','0.2%','0.2%'))
    if(dow===3&&day>=15&&day<=21){events.push(mk(date,'12:30','US Retail Sales MoM','USD','United States','high','0.3%','0.4%'));events.push(mk(date,'06:00','UK CPI YoY','GBP','United Kingdom','high','2.5%','2.6%'))}
    if(dow===4&&day>=25)events.push(mk(date,'12:30','US Core PCE Price Index MoM','USD','United States','high','0.3%','0.3%'))
    if(dow===3&&day>=25)events.push(mk(date,'12:30','US GDP Growth Rate QoQ','USD','United States','high','2.3%','2.4%'))
    if(dow===3&&day>=10&&day<=16&&mon%2===0){events.push(mk(date,'18:00','Fed Interest Rate Decision','USD','United States','high','4.25%','4.50%'));events.push(mk(date,'18:30','FOMC Press Conference','USD','United States','high',null,null))}
    if(dow===4&&day>=3&&day<=9&&mon%2!==0){events.push(mk(date,'12:15','ECB Interest Rate Decision','EUR','Eurozone','high','2.15%','2.40%'));events.push(mk(date,'12:45','ECB Press Conference','EUR','Eurozone','high',null,null))}
    if(dow===4&&day>=6&&day<=12&&mon%2!==0)events.push(mk(date,'11:00','BOE Interest Rate Decision','GBP','United Kingdom','high','4.25%','4.50%'))
  })
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time))
}
