'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const PLANS = [
  {
    name: 'Free', price: '$0', period: '/month', color: '#8b949e',
    desc: 'Perfect to get started',
    features: ['10 trades per day','Unlimited total trades','AI Insights','Performance analytics','Backtesting','CSV import (1/day)'],
    cta: 'Current Plan', highlight: false, tier: 'free'
  },
  {
    name: 'Pro', price: '$9.99', period: '/month', color: '#00d4aa',
    desc: 'For serious traders',
    features: ['Unlimited trades/day','Everything in Free','Gemini Deep AI','All 50+ analytics','Smart Playbooks','CSV Export','10 imports/day'],
    cta: 'Upgrade to Pro', highlight: true, tier: 'pro'
  },
  {
    name: 'Elite', price: '$24', period: '/month', color: '#e3b341',
    desc: 'For professional traders',
    features: ['Everything in Pro','Prop Firm Tracker','Pass-probability AI','Unlimited imports','API Access','Priority support'],
    cta: 'Go Elite', highlight: false, tier: 'elite'
  },
]

export default function PricingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [currentTier, setCurrentTier] = useState<string>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
      setCurrentTier(data?.subscription_tier || 'free')
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', padding:'60px 20px' }}>
      <div style={{ maxWidth:'960px', margin:'0 auto' }}>

        {/* Back button */}
        <button onClick={()=>router.back()} style={{ background:'none', border:'none', color:'#8b949e', fontSize:'13px', cursor:'pointer', marginBottom:'24px', display:'flex', alignItems:'center', gap:'5px' }}>
          ← Back
        </button>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:'48px' }}>
          <div style={{ display:'inline-block', background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.2)', borderRadius:'50px', padding:'4px 14px', fontSize:'11px', color:'#00d4aa', fontWeight:'700', letterSpacing:'2px', marginBottom:'14px', textTransform:'uppercase' }}>
            Pricing
          </div>
          <h1 style={{ fontSize:'40px', fontWeight:'800', color:'#e6edf3', margin:'0 0 12px', letterSpacing:'-1px' }}>
            Simple, transparent pricing
          </h1>
          <p style={{ color:'#8b949e', fontSize:'16px', margin:0 }}>
            Start free. Upgrade when ready. Cancel anytime.
          </p>
          {currentTier !== 'free' && (
            <div style={{ display:'inline-block', marginTop:'12px', background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.2)', borderRadius:'8px', padding:'6px 14px', fontSize:'12px', color:'#00d4aa' }}>
              ✅ You are on the <strong>{currentTier.toUpperCase()}</strong> plan
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', alignItems:'start', marginBottom:'40px' }}>
          {PLANS.map(p => {
            const isCurrent = currentTier === p.tier
            return (
              <div key={p.name} style={{
                background: p.highlight ? 'linear-gradient(180deg,rgba(0,212,170,0.06),#161b22)' : '#161b22',
                border: `2px solid ${isCurrent ? '#00d4aa' : p.highlight ? p.color : '#21262d'}`,
                borderRadius:'16px', padding:'28px 24px', position:'relative', overflow:'hidden',
                transition:'transform 0.2s',
              }}>
                {p.highlight && !isCurrent && (
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'2px', background:`linear-gradient(90deg,transparent,${p.color},transparent)` }}/>
                )}
                {isCurrent && (
                  <div style={{ position:'absolute', top:'14px', right:'14px', background:'#00d4aa', color:'#0d1117', fontSize:'9px', fontWeight:'800', padding:'2px 8px', borderRadius:'20px' }}>YOUR PLAN</div>
                )}
                {p.highlight && !isCurrent && (
                  <div style={{ position:'absolute', top:'14px', right:'14px', background:p.color, color:'#0d1117', fontSize:'9px', fontWeight:'800', padding:'2px 8px', borderRadius:'20px' }}>POPULAR</div>
                )}

                <div style={{ fontSize:'11px', color:p.color, fontWeight:'700', textTransform:'uppercase', letterSpacing:'2px', marginBottom:'6px' }}>{p.name}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:'3px', marginBottom:'6px' }}>
                  <span style={{ fontSize:'42px', fontWeight:'800', color:'#e6edf3', letterSpacing:'-2px' }}>{p.price}</span>
                  <span style={{ fontSize:'13px', color:'#8b949e' }}>{p.period}</span>
                </div>
                <div style={{ fontSize:'12px', color:'#8b949e', marginBottom:'20px' }}>{p.desc}</div>

                {isCurrent ? (
                  <div style={{ display:'block', padding:'11px', borderRadius:'9px', textAlign:'center', fontSize:'13px', fontWeight:'700', background:'#21262d', color:'#8b949e', marginBottom:'0' }}>
                    ✓ Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      // TODO: Connect LemonSqueezy checkout here
                      alert(`To upgrade to ${p.name}, set up LemonSqueezy payment. For now contact: ghazuali8@gmail.com`)
                    }}
                    style={{ display:'block', width:'100%', padding:'11px', borderRadius:'9px', textAlign:'center', fontSize:'13px', fontWeight:'700', cursor:'pointer', border:'none',
                      background: p.highlight ? p.color : `${p.color}22`,
                      color: p.highlight ? '#0d1117' : p.color,
                    }}>
                    {p.cta} →
                  </button>
                )}

                <div style={{ borderTop:'1px solid #21262d', margin:'18px 0 0', paddingTop:'14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                  {p.features.map(f => (
                    <div key={f} style={{ display:'flex', gap:'8px', fontSize:'13px', color:'#e6edf3' }}>
                      <span style={{ color:p.color, fontWeight:'700', flexShrink:0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Plan comparison table */}
        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', overflow:'hidden', marginBottom:'32px' }}>
          <div style={{ padding:'18px 24px', borderBottom:'1px solid #21262d' }}>
            <div style={{ fontSize:'16px', fontWeight:'600', color:'#e6edf3' }}>Plan Comparison</div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#0d1117' }}>
                <th style={{ padding:'12px 24px', textAlign:'left', fontSize:'12px', color:'#8b949e', fontWeight:'600', borderBottom:'1px solid #21262d' }}>Feature</th>
                {['Free','Pro','Elite'].map(t=>(
                  <th key={t} style={{ padding:'12px 24px', textAlign:'center', fontSize:'12px', color: t==='Pro'?'#00d4aa':t==='Elite'?'#e3b341':'#8b949e', fontWeight:'700', borderBottom:'1px solid #21262d' }}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Trades per day', '10', 'Unlimited', 'Unlimited'],
                ['Total trades', '50', 'Unlimited', 'Unlimited'],
                ['Analytics reports', 'Basic', 'All 50+', 'All 50+'],
                ['AI Insights', '✅', '✅', '✅'],
                ['Gemini Deep AI', '❌', '✅', '✅'],
                ['Backtesting', '✅', '✅', '✅'],
                ['Smart Playbooks', '❌', '✅', '✅'],
                ['CSV Export', '❌', '✅', '✅'],
                ['CSV Import/day', '1', '10', 'Unlimited'],
                ['Prop Firm Tracker', '❌', '❌', '✅'],
                ['API Access', '❌', '❌', '✅'],
                ['Backtest sessions', 'Unlimited', 'Unlimited', 'Unlimited'],
                ['Support', 'Community', 'Priority', 'Dedicated'],
              ].map(([feat, free, pro, elite], i) => (
                <tr key={feat} style={{ borderBottom:'1px solid #21262d', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding:'12px 24px', fontSize:'13px', color:'#e6edf3' }}>{feat}</td>
                  <td style={{ padding:'12px 24px', textAlign:'center', fontSize:'13px', color: free==='❌'?'#f85149':free==='✅'?'#3fb950':'#8b949e' }}>{free}</td>
                  <td style={{ padding:'12px 24px', textAlign:'center', fontSize:'13px', color: pro==='❌'?'#f85149':pro==='✅'?'#3fb950':'#00d4aa', fontWeight: pro!=='❌'&&pro!=='✅'?'600':'400' }}>{pro}</td>
                  <td style={{ padding:'12px 24px', textAlign:'center', fontSize:'13px', color: elite==='❌'?'#f85149':elite==='✅'?'#3fb950':'#e3b341', fontWeight: elite!=='❌'&&elite!=='✅'?'600':'400' }}>{elite}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes */}
        <div style={{ display:'flex', gap:'20px', justifyContent:'center', flexWrap:'wrap' }}>
          {['No setup fees','Cancel anytime','Secure payments','Free plan forever'].map(t=>(
            <span key={t} style={{ fontSize:'12px', color:'#8b949e', display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ color:'#00d4aa' }}>✓</span>{t}
            </span>
          ))}
        </div>

      </div>
    </div>
  )
}
