'use client'
import { useRouter } from 'next/navigation'

interface Props {
  feature: string
  description?: string
  requiredTier: 'pro' | 'elite'
  compact?: boolean
  onClose?: () => void
}

export default function UpgradeWall({ feature, description, requiredTier, compact, onClose }: Props) {
  const router = useRouter()
  const tierColor = requiredTier === 'pro' ? '#00d4aa' : '#e3b341'
  const tierPrice = requiredTier === 'pro' ? '$9.99/month' : '$24/month'

  // Compact banner version
  if (compact) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background: requiredTier==='pro'?'rgba(0,212,170,0.08)':'rgba(227,179,65,0.08)', border:`1px solid ${requiredTier==='pro'?'rgba(0,212,170,0.25)':'rgba(227,179,65,0.25)'}`, borderRadius:'10px', gap:'10px' }}>
      <div style={{ display:'flex', gap:'10px', alignItems:'center', flex:1 }}>
        <span style={{ fontSize:'18px' }}>🔒</span>
        <div>
          <div style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3' }}>{feature}</div>
          <div style={{ fontSize:'11px', color:'#8b949e' }}>Requires {requiredTier === 'pro' ? 'Pro' : 'Elite'} plan · {tierPrice}</div>
        </div>
      </div>
      <button onClick={()=>router.push('/pricing')} style={{ padding:'7px 14px', background:tierColor, border:'none', borderRadius:'7px', color:'#0d1117', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>
        Upgrade →
      </button>
    </div>
  )

  // Full upgrade modal/screen
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'56px 24px', textAlign:'center', background:'#161b22', border:`1px solid ${tierColor}33`, borderRadius:'14px', position:'relative' }}>
      {onClose && (
        <button onClick={onClose} style={{ position:'absolute', top:'14px', right:'14px', background:'#21262d', border:'none', borderRadius:'6px', width:'28px', height:'28px', color:'#8b949e', cursor:'pointer' }}>✕</button>
      )}
      <div style={{ fontSize:'52px', marginBottom:'16px' }}>🔒</div>
      <div style={{ fontSize:'20px', fontWeight:'700', color:'#e6edf3', marginBottom:'8px' }}>{feature}</div>
      {description && <p style={{ color:'#8b949e', fontSize:'14px', maxWidth:'400px', lineHeight:'1.6', marginBottom:'24px' }}>{description}</p>}
      <div style={{ display:'inline-flex', gap:'8px', alignItems:'center', marginBottom:'20px', padding:'8px 16px', background:`${tierColor}15`, border:`1px solid ${tierColor}33`, borderRadius:'8px' }}>
        <span style={{ fontSize:'13px', color:tierColor, fontWeight:'700' }}>
          {requiredTier === 'pro' ? '⚡ Pro' : '💎 Elite'} — {tierPrice}
        </span>
      </div>
      <button onClick={() => router.push('/pricing')}
        style={{ padding:'12px 32px', background:`linear-gradient(135deg,${tierColor},${tierColor}dd)`, border:'none', borderRadius:'10px', color:'#0d1117', fontSize:'14px', fontWeight:'700', cursor:'pointer' }}>
        Upgrade Now →
      </button>
      <button onClick={() => router.push('/pricing')} style={{ marginTop:'10px', background:'none', border:'none', color:'#8b949e', fontSize:'12px', cursor:'pointer' }}>
        View all plans →
      </button>
    </div>
  )
}
