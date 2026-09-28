'use client'
import { useState } from 'react'

export interface IndicatorConfig {
  id: string
  type: 'EMA'|'SMA'|'RSI'|'MACD'|'BB'|'VOLUME'
  length: number
  color: string
  visible: boolean
}

const DEFAULTS: Omit<IndicatorConfig,'id'>[] = [
  { type:'EMA',   length:9,  color:'#e3b341', visible:true  },
  { type:'EMA',   length:21, color:'#79c0ff', visible:true  },
  { type:'EMA',   length:50, color:'#ff7b72', visible:false },
  { type:'SMA',   length:20, color:'#d2a8ff', visible:false },
  { type:'RSI',   length:14, color:'#79c0ff', visible:false },
  { type:'MACD',  length:12, color:'#79c0ff', visible:false },
  { type:'BB',    length:20, color:'#58a6ff', visible:false },
  { type:'VOLUME',length:0,  color:'#26a69a', visible:true  },
]

const COLORS = ['#e3b341','#79c0ff','#ff7b72','#3fb950','#d2a8ff','#f78166','#00d4aa','#ffffff']

interface Props {
  indicators: IndicatorConfig[]
  onChange: (indicators: IndicatorConfig[]) => void
  onClose: () => void
}

export default function IndicatorPanel({ indicators, onChange, onClose }: Props) {
  const [editing, setEditing] = useState<string|null>(null)

  function toggle(id: string) {
    onChange(indicators.map(i => i.id===id ? {...i,visible:!i.visible} : i))
  }
  function updateLength(id: string, length: number) {
    onChange(indicators.map(i => i.id===id ? {...i,length} : i))
  }
  function updateColor(id: string, color: string) {
    onChange(indicators.map(i => i.id===id ? {...i,color} : i))
  }
  function addIndicator(type: IndicatorConfig['type']) {
    const def = DEFAULTS.find(d=>d.type===type)
    onChange([...indicators, {...(def||DEFAULTS[0]), id: Date.now().toString(), visible:true}])
  }
  function removeIndicator(id: string) {
    onChange(indicators.filter(i=>i.id!==id))
  }

  const btn = (style?:any) => ({
    style: {
      background:'transparent', border:'1px solid #30363d', borderRadius:'5px',
      color:'#8b949e', cursor:'pointer', fontSize:'10px', padding:'2px 7px',
      ...style
    }
  })

  return (
    <div style={{position:'absolute',top:0,right:0,width:'280px',height:'100%',background:'#161b22',borderLeft:'1px solid #21262d',zIndex:200,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderBottom:'1px solid #21262d',flexShrink:0}}>
        <span style={{fontSize:'13px',fontWeight:'600',color:'#e6edf3'}}>Indicators</span>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#8b949e',cursor:'pointer',fontSize:'16px'}}>✕</button>
      </div>

      {/* Add indicator buttons */}
      <div style={{padding:'10px 14px',borderBottom:'1px solid #21262d',flexShrink:0}}>
        <div style={{fontSize:'10px',color:'#8b949e',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'1px'}}>Add Indicator</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
          {(['EMA','SMA','RSI','MACD','BB','VOLUME'] as const).map(t=>(
            <button key={t} onClick={()=>addIndicator(t)}
              style={{padding:'4px 10px',borderRadius:'5px',fontSize:'11px',cursor:'pointer',background:'#21262d',border:'1px solid #30363d',color:'#e6edf3',fontWeight:'500'}}>
              + {t}
            </button>
          ))}
        </div>
      </div>

      {/* Active indicators */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 0'}}>
        {indicators.length===0 && (
          <div style={{textAlign:'center',padding:'20px',color:'#8b949e',fontSize:'12px'}}>No indicators. Add one above.</div>
        )}
        {indicators.map(ind=>(
          <div key={ind.id} style={{borderBottom:'1px solid #21262d',padding:'0'}}>
            {/* Indicator row */}
            <div style={{display:'flex',alignItems:'center',gap:'6px',padding:'8px 14px'}}>
              <button onClick={()=>toggle(ind.id)}
                style={{width:'14px',height:'14px',borderRadius:'3px',border:`1px solid ${ind.color}`,background:ind.visible?ind.color:'transparent',cursor:'pointer',flexShrink:0,padding:0}}/>
              <div style={{width:'10px',height:'3px',background:ind.color,borderRadius:'2px',flexShrink:0}}/>
              <span style={{fontSize:'12px',color:'#e6edf3',flex:1,fontWeight:'500'}}>
                {ind.type}{ind.length>0?` (${ind.length})`:''}
              </span>
              <button onClick={()=>setEditing(editing===ind.id?null:ind.id)} {...btn()}>⚙</button>
              <button onClick={()=>removeIndicator(ind.id)} {...btn({color:'#f85149',borderColor:'#f8514966'})}>✕</button>
            </div>

            {/* Settings panel */}
            {editing===ind.id && (
              <div style={{padding:'8px 14px 12px',background:'#0d1117'}}>
                {ind.length>0 && (
                  <div style={{marginBottom:'8px'}}>
                    <label style={{fontSize:'10px',color:'#8b949e',display:'block',marginBottom:'3px'}}>Length</label>
                    <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                      <input type="number" value={ind.length} onChange={e=>updateLength(ind.id,parseInt(e.target.value)||1)}
                        style={{width:'70px',padding:'4px 7px',background:'#161b22',border:'1px solid #30363d',borderRadius:'5px',color:'#e6edf3',fontSize:'12px',outline:'none'}}/>
                      {[9,14,20,21,50,200].map(v=>(
                        <button key={v} onClick={()=>updateLength(ind.id,v)}
                          style={{padding:'3px 6px',background:ind.length===v?'#00d4aa22':'#161b22',border:`1px solid ${ind.length===v?'#00d4aa':'#30363d'}`,borderRadius:'4px',color:ind.length===v?'#00d4aa':'#8b949e',cursor:'pointer',fontSize:'10px'}}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label style={{fontSize:'10px',color:'#8b949e',display:'block',marginBottom:'3px'}}>Color</label>
                  <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                    {COLORS.map(c=>(
                      <button key={c} onClick={()=>updateColor(ind.id,c)}
                        style={{width:'20px',height:'20px',borderRadius:'50%',background:c,border:ind.color===c?'2px solid #fff':'2px solid transparent',cursor:'pointer',padding:0}}/>
                    ))}
                    <input type="color" value={ind.color} onChange={e=>updateColor(ind.id,e.target.value)}
                      style={{width:'20px',height:'20px',borderRadius:'50%',border:'none',cursor:'pointer',padding:0,background:'none'}}/>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export { DEFAULTS }
