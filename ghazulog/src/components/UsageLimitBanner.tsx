'use client'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/hooks/useSubscription'

export default function UsageLimitBanner() {
  const router = useRouter()
  const { tier, todayTrades, limits, tradesRemaining, loading } = useSubscription()

  if (loading || tier === 'elite') return null

  const percent = Math.min(100, (todayTrades / limits.tradesPerDay) * 100)
  const isAtLimit = tradesRemaining === 0
  const isNearLimit = tradesRemaining <= 1

  // Don't show banner for Pro unless near limit
  if (tier === 'pro' && !isNearLimit) return null

  return (
    <div style={{ background: isAtLimit?'rgba(248,81,73,0.08)':isNearLimit?'rgba(227,179,65,0.08)':'rgba(0,212,170,0.06)', border:`1px solid ${isAtLimit?'rgba(248,81,73,0.25)':isNearLimit?'rgba(227,179,65,0.25)':'rgba(0,212,170,0.2)'}`, borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:'200px' }}>
        <span style={{ fontSize:'20px' }}>{isAtLimit?'🚫':isNearLimit?'⚠️':'📊'}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3', marginBottom:'4px' }}>
            {isAtLimit ? `Daily limit reached (${limits.tradesPerDay} trades)` 
              : isNearLimit ? `${tradesRemaining} trade${tradesRemaining===1?'':'s'} remaining today` 
              : `${todayTrades} of ${limits.tradesPerDay} trades used today`}
          </div>
          {/* Progress bar */}
          <div style={{ height:'5px', background:'#21262d', borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ width:`${percent}%`, height:'100%', background: isAtLimit?'#f85149':isNearLimit?'#e3b341':'#00d4aa', borderRadius:'3px', transition:'width 0.3s' }}/>
          </div>
        </div>
      </div>
      <button onClick={()=>router.push('/pricing')}
        style={{ padding:'8px 16px', background: isAtLimit?'#f85149':'#00d4aa', border:'none', borderRadius:'7px', color:'#0d1117', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>
        {tier === 'free' ? '⚡ Upgrade to Pro' : '💎 Upgrade to Elite'}
      </button>
    </div>
  )
}
