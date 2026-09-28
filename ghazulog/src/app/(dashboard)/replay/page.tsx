'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EconomicEvent {
  id: string; event: string; date: string; time: string
  country: string; currency: string; impact: 'high'|'medium'|'low'
  actual: string|null; forecast: string|null; previous: string|null
}
interface EventNote { event_id: string; note: string; reaction: string }

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday + offset * 7)
  monday.setHours(0,0,0,0)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  const friday = new Date(monday); friday.setDate(monday.getDate() + 4)
  return { days, monday, friday }
}

function impactColor(i: string) { return i==='high'?'#f85149':i==='medium'?'#e3b341':'#3fb950' }
function impactBg(i: string)    { return i==='high'?'rgba(248,81,73,0.05)':i==='medium'?'rgba(227,179,65,0.03)':'transparent' }

function formatDateLabel(dateStr: string) {
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0]
  const d = new Date(dateStr+'T00:00:00')
  const label = d.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric',year:'numeric'})
  if (dateStr===today)    return `📍 Today — ${label}`
  if (dateStr===tomorrow) return `Tomorrow — ${label}`
  return label
}

const FLAG: Record<string,string> = { USD:'🇺🇸', EUR:'🇪🇺', GBP:'🇬🇧', JPY:'🇯🇵', CNY:'🇨🇳', AUD:'🇦🇺', CAD:'🇨🇦', BTC:'₿', CHF:'🇨🇭', NZD:'🇳🇿' }

export default function EconomicCalendarPage() {
  const supabase = createClient()
  const [events,       setEvents]       = useState<EconomicEvent[]>([])
  const [loading,      setLoading]      = useState(true)
  const [weekOffset,   setWeekOffset]   = useState(0)
  const [filterImpact, setFilterImpact] = useState<'all'|'high'|'medium'>('high')
  const [filterCur,    setFilterCur]    = useState<string>('all')
  const [notes,        setNotes]        = useState<Record<string,EventNote>>({})
  const [activeNote,   setActiveNote]   = useState<string|null>(null)
  const [noteText,     setNoteText]     = useState('')
  const [noteReaction, setNoteReaction] = useState('')
  const [userId,       setUserId]       = useState<string|null>(null)
  const [saving,       setSaving]       = useState(false)
  const [source,       setSource]       = useState('')

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{ if(data.user)setUserId(data.user.id) })
  },[])

  const loadEvents = useCallback(async()=>{
    setLoading(true)
    const {days} = getWeekDates(weekOffset)
    const from = days[0], to = days[days.length-1]
    try {
      const res = await fetch(`/api/economic-calendar?from=${from}&to=${to}`)
      const j   = await res.json()
      setEvents(j.events || [])
      setSource(j.source || '')
    } catch {
      setEvents([])
    }
    setLoading(false)
  },[weekOffset])

  useEffect(()=>{ loadEvents() },[loadEvents])

  useEffect(()=>{
    if(userId) fetchNotes()
  },[userId])

  async function fetchNotes(){
    const {data} = await supabase.from('economic_events_notes').select('*').eq('user_id',userId)
    if(data){
      const map:Record<string,EventNote>={}
      data.forEach((n:any)=>{ map[n.event_id]=n })
      setNotes(map)
    }
  }

  async function saveNote(event: EconomicEvent){
    if(!userId)return
    setSaving(true)
    await supabase.from('economic_events_notes').upsert({
      event_id:event.id, event_date:event.date, event_name:event.event,
      user_id:userId, note:noteText, reaction:noteReaction
    },{onConflict:'event_id,user_id'})
    setNotes(prev=>({...prev,[event.id]:{event_id:event.id,note:noteText,reaction:noteReaction}}))
    setSaving(false); setActiveNote(null)
  }

  function openNote(event: EconomicEvent){
    const ex = notes[event.id]
    setNoteText(ex?.note||''); setNoteReaction(ex?.reaction||'')
    setActiveNote(event.id)
  }

  // Filter
  const filtered = events.filter(e=>{
    if(filterImpact!=='all'&&e.impact!==filterImpact) return false
    if(filterCur!=='all'&&e.currency!==filterCur) return false
    return true
  })

  // Group by date
  const grouped:Record<string,EconomicEvent[]>={}
  filtered.forEach(e=>{ if(!grouped[e.date])grouped[e.date]=[]; grouped[e.date].push(e) })
  const sortedDates = Object.keys(grouped).sort()

  const {monday,friday} = getWeekDates(weekOffset)
  const weekLabel = `${monday.toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${friday.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`

  const currencies = ['all',...Array.from(new Set(events.map(e=>e.currency))).sort()]

  const navBtn:React.CSSProperties = { padding:'7px 14px', borderRadius:'8px', border:'1px solid #30363d', background:'transparent', color:'#8b949e', fontSize:'12px', cursor:'pointer' }

  return (
    <div style={{color:'#e6edf3',maxWidth:'1200px',margin:'0 auto',fontFamily:'-apple-system,sans-serif'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px',flexWrap:'wrap',gap:'12px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:'700',margin:'0 0 4px'}}>📅 Economic Calendar</h1>
          <p style={{color:'#8b949e',fontSize:'13px',margin:0}}>
            Real high-impact macro events · {source==='FMP'?'🟢 Live FMP data':source==='curated'?'📋 Curated schedule':'Loading...'}
          </p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
          <button onClick={()=>setWeekOffset(w=>w-1)} style={navBtn}>‹ Prev</button>
          <span style={{fontSize:'13px',color:'#e6edf3',fontWeight:'600',background:'#161b22',border:'1px solid #30363d',borderRadius:'8px',padding:'7px 16px',minWidth:'190px',textAlign:'center'}}>
            {weekLabel}
          </span>
          <button onClick={()=>setWeekOffset(w=>w+1)} style={navBtn}>Next ›</button>
          {weekOffset!==0&&<button onClick={()=>setWeekOffset(0)} style={{...navBtn,color:'#00d4aa',borderColor:'#00d4aa'}}>This Week</button>}
          <button onClick={loadEvents} style={{...navBtn,color:'#00d4aa',borderColor:'#00d4aa'}}>🔄 Refresh</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
        {[
          {label:'High Impact',  count:events.filter(e=>e.impact==='high').length,   color:'#f85149'},
          {label:'Medium Impact',count:events.filter(e=>e.impact==='medium').length, color:'#e3b341'},
          {label:'Total Events', count:events.length,                                color:'#00d4aa'},
          {label:'My Notes',     count:Object.keys(notes).length,                   color:'#7c3aed'},
        ].map(s=>(
          <div key={s.label} style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'10px',padding:'10px 18px'}}>
            <span style={{fontSize:'20px',fontWeight:'700',color:s.color,display:'block'}}>{s.count}</span>
            <span style={{fontSize:'11px',color:'#8b949e'}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
        {[{v:'high',l:'🔴 High Only'},{v:'medium',l:'🟡 Medium+'},{v:'all',l:'📋 All'}].map(f=>(
          <button key={f.v} onClick={()=>setFilterImpact(f.v as any)} style={{
            padding:'5px 14px',borderRadius:'20px',border:'1px solid',fontSize:'12px',cursor:'pointer',
            borderColor:filterImpact===f.v?'#00d4aa':'#30363d',
            background:filterImpact===f.v?'rgba(0,212,170,0.1)':'transparent',
            color:filterImpact===f.v?'#00d4aa':'#8b949e'
          }}>{f.l}</button>
        ))}
        <div style={{width:'1px',height:'20px',background:'#30363d'}}/>
        {/* Currency filter */}
        <select value={filterCur} onChange={e=>setFilterCur(e.target.value)}
          style={{background:'#161b22',border:'1px solid #30363d',borderRadius:'8px',color:'#e6edf3',fontSize:'12px',padding:'5px 10px',outline:'none'}}>
          {currencies.map(c=><option key={c} value={c}>{c==='all'?'All Currencies':c}</option>)}
        </select>
        <div style={{marginLeft:'auto',display:'flex',gap:'12px'}}>
          {[['#f85149','High'],['#e3b341','Medium'],['#3fb950','Low']].map(([c,l])=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'11px',color:'#8b949e'}}>
              <div style={{width:'8px',height:'8px',borderRadius:'50%',background:c,boxShadow:`0 0 4px ${c}`}}/>{l}
            </div>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading&&(
        <div style={{textAlign:'center',padding:'48px',color:'#8b949e'}}>
          <div style={{fontSize:'24px',marginBottom:'8px'}}>⏳</div>
          Loading economic events...
        </div>
      )}

      {/* Empty */}
      {!loading&&sortedDates.length===0&&(
        <div style={{textAlign:'center',padding:'48px',background:'#161b22',borderRadius:'12px',color:'#8b949e'}}>
          <div style={{fontSize:'28px',marginBottom:'8px'}}>📭</div>
          No events found for this week with current filters
        </div>
      )}

      {/* Events */}
      {!loading&&sortedDates.map(date=>(
        <div key={date} style={{marginBottom:'24px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 14px',marginBottom:'8px',background:'#161b22',borderRadius:'10px',border:'1px solid #21262d'}}>
            <span style={{fontSize:'13px',fontWeight:'600',color:'#00d4aa',flex:1}}>{formatDateLabel(date)}</span>
            <span style={{fontSize:'11px',color:'#8b949e',background:'#21262d',borderRadius:'12px',padding:'3px 10px'}}>{grouped[date].length} events</span>
          </div>
          <div style={{background:'#161b22',borderRadius:'10px',border:'1px solid #21262d',overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{background:'#0d1117'}}>
                  {['Time','','Currency','Event','Forecast','Previous','Actual',''].map((h,i)=>(
                    <th key={i} style={{padding:'8px 12px',textAlign:'left',fontSize:'10px',color:'#8b949e',fontWeight:'600',letterSpacing:'0.06em',textTransform:'uppercase',borderBottom:'1px solid #21262d'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grouped[date].sort((a,b)=>a.time.localeCompare(b.time)).map((event,i)=>{
                  const hasNote = !!notes[event.id]
                  const isLast  = i===grouped[date].length-1
                  return(
                    <tr key={event.id} style={{borderBottom:isLast?'none':'1px solid #21262d',background:impactBg(event.impact),transition:'background .15s'}}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.02)')}
                      onMouseLeave={e=>(e.currentTarget.style.background=impactBg(event.impact))}>
                      <td style={{padding:'11px 12px',fontSize:'12px',color:'#8b949e',whiteSpace:'nowrap',width:'72px'}}>{event.time}</td>
                      <td style={{padding:'11px 8px',width:'18px'}}>
                        <div style={{width:'9px',height:'9px',borderRadius:'50%',background:impactColor(event.impact),boxShadow:`0 0 5px ${impactColor(event.impact)}`}}/>
                      </td>
                      <td style={{padding:'11px 12px',width:'72px'}}>
                        <span style={{fontSize:'11px',fontWeight:'700',display:'flex',alignItems:'center',gap:'4px'}}>
                          <span>{FLAG[event.currency]||'🌐'}</span>
                          <span style={{background:'#21262d',borderRadius:'4px',padding:'2px 5px',color:'#e6edf3'}}>{event.currency}</span>
                        </span>
                      </td>
                      <td style={{padding:'11px 12px',fontSize:'13px',color:'#e6edf3',maxWidth:'280px'}}>
                        <div style={{fontWeight:event.impact==='high'?'600':'400'}}>{event.event}</div>
                        <div style={{fontSize:'10px',color:'#8b949e',marginTop:'1px'}}>{event.country}</div>
                        {hasNote&&notes[event.id]?.reaction&&(
                          <div style={{fontSize:'10px',color:'#00d4aa',marginTop:'2px'}}>{notes[event.id].reaction}</div>
                        )}
                      </td>
                      <td style={{padding:'11px 12px',fontSize:'13px',color:'#8b949e',width:'90px'}}>{event.forecast??<span style={{color:'#30363d'}}>—</span>}</td>
                      <td style={{padding:'11px 12px',fontSize:'13px',color:'#8b949e',width:'90px'}}>{event.previous??<span style={{color:'#30363d'}}>—</span>}</td>
                      <td style={{padding:'11px 12px',fontSize:'13px',fontWeight:'600',width:'90px'}}>
                        {event.actual
                          ? <span style={{color:event.forecast&&parseFloat(event.actual)>parseFloat(event.forecast)?'#3fb950':'#f85149'}}>{event.actual}</span>
                          : <span style={{fontSize:'11px',color:'#30363d'}}>Pending</span>}
                      </td>
                      <td style={{padding:'11px 12px',width:'80px'}}>
                        <button onClick={()=>openNote(event)} style={{
                          padding:'3px 9px',fontSize:'11px',borderRadius:'5px',border:'1px solid',cursor:'pointer',
                          borderColor:hasNote?'#00d4aa':'#30363d',
                          background:hasNote?'rgba(0,212,170,0.08)':'transparent',
                          color:hasNote?'#00d4aa':'#8b949e'
                        }}>{hasNote?'📝 Edit':'+ Note'}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Note Modal */}
      {activeNote&&(()=>{
        const event=events.find(e=>e.id===activeNote)
        if(!event)return null
        return(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}
            onClick={()=>setActiveNote(null)}>
            <div style={{background:'#161b22',border:'1px solid #30363d',borderRadius:'14px',padding:'28px',width:'520px',maxWidth:'92vw'}}
              onClick={e=>e.stopPropagation()}>
              <h3 style={{margin:'0 0 4px',fontSize:'16px',color:'#e6edf3'}}>📝 Trade Note</h3>
              <p style={{margin:'0 0 16px',fontSize:'12px',color:'#8b949e'}}>{event.event} · {event.date} {event.time} UTC</p>
              <div style={{marginBottom:'14px'}}>
                <label style={{fontSize:'12px',color:'#8b949e',display:'block',marginBottom:'8px'}}>Expected Market Reaction</label>
                <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
                  {['📈 Bullish','📉 Bearish','😐 Neutral','⚠️ Watch','🚫 Avoid'].map(r=>(
                    <button key={r} onClick={()=>setNoteReaction(noteReaction===r?'':r)} style={{
                      padding:'6px 12px',fontSize:'12px',borderRadius:'7px',border:'1px solid',cursor:'pointer',
                      borderColor:noteReaction===r?'#00d4aa':'#30363d',
                      background:noteReaction===r?'rgba(0,212,170,0.12)':'#0d1117',
                      color:noteReaction===r?'#00d4aa':'#8b949e'
                    }}>{r}</button>
                  ))}
                </div>
              </div>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)}
                placeholder="Write your analysis, trade plan, or observations for this event..."
                style={{width:'100%',height:'120px',background:'#0d1117',border:'1px solid #30363d',borderRadius:'8px',color:'#e6edf3',fontSize:'13px',padding:'10px',resize:'vertical',fontFamily:'inherit',boxSizing:'border-box',outline:'none',lineHeight:'1.5'}}/>
              <div style={{display:'flex',gap:'8px',marginTop:'14px',justifyContent:'flex-end'}}>
                <button onClick={()=>setActiveNote(null)} style={navBtn}>Cancel</button>
                <button onClick={()=>saveNote(event)} disabled={saving} style={{padding:'8px 20px',borderRadius:'8px',border:'none',background:'#00d4aa',color:'#0d1117',fontSize:'13px',fontWeight:'600',cursor:'pointer',opacity:saving?.7:1}}>
                  {saving?'Saving...':'Save Note'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

const navBtn:React.CSSProperties={padding:'7px 14px',borderRadius:'8px',border:'1px solid #30363d',background:'transparent',color:'#8b949e',fontSize:'12px',cursor:'pointer'}
