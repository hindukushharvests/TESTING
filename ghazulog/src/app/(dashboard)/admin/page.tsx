'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const fmt = (d: string|null) => d ? new Date(d).toLocaleDateString() : '—'

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState<boolean|null>(null)
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterTier, setFilterTier] = useState('all')
  const [msg, setMsg] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) { setIsAdmin(false); setLoading(false); return }
    setIsAdmin(true)
    loadUsers()
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.users) setUsers(data.users)
      else setMsg(`⚠️ ${data.error || 'Failed to load'}`)
    } catch (e: any) {
      setMsg(`⚠️ ${e.message}`)
    }
    setLoading(false)
  }

  async function setTier(userId: string, tier: string, days: number|null, email: string) {
    setMsg(`Updating ${email}...`)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier, days }),
      })
      const data = await res.json()
      if (data.success) {
        setMsg(`✅ ${email} → ${tier.toUpperCase()}${days ? ` (${days}d)` : tier==='free'?'':' forever'}`)
        loadUsers()
      } else setMsg(`❌ ${data.error}`)
    } catch (e: any) { setMsg(`❌ ${e.message}`) }
    setTimeout(() => setMsg(''), 3000)
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#8b949e' }}>Loading...</div>

  if (isAdmin === false) return (
    <div style={{ maxWidth:'500px', margin:'60px auto', textAlign:'center' }}>
      <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
      <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e6edf3', marginBottom:'8px' }}>Access Denied</h1>
      <p style={{ color:'#8b949e', fontSize:'14px' }}>Administrators only.</p>
    </div>
  )

  const filtered = users.filter(u => {
    const ms = !search || u.email.toLowerCase().includes(search.toLowerCase())
    const mt = filterTier === 'all' || u.subscription_tier === filterTier
    return ms && mt
  })

  const stats = {
    total: users.length,
    free: users.filter(u => u.subscription_tier === 'free').length,
    pro: users.filter(u => u.subscription_tier === 'pro').length,
    elite: users.filter(u => u.subscription_tier === 'elite').length,
  }

  const card: React.CSSProperties = { background:'rgba(22,27,34,0.55)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', border:'1px solid #21262d', borderRadius:'14px', padding:'18px' }

  return (
    <div style={{ maxWidth:'1200px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ marginBottom:'20px' }}>
        <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>👑 Admin Panel</h1>
        <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>Manage user subscriptions & beta access</p>
      </div>

      {msg && <div style={{ background: msg.startsWith('✅')?'rgba(63,185,80,0.1)':'rgba(248,81,73,0.1)', border:`1px solid ${msg.startsWith('✅')?'rgba(63,185,80,0.3)':'rgba(248,81,73,0.3)'}`, borderRadius:'10px', padding:'12px 16px', marginBottom:'16px', color: msg.startsWith('✅')?'#3fb950':'#e3b341', fontSize:'13px' }}>{msg}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[['Total',stats.total,'#e6edf3'],['Free',stats.free,'#8b949e'],['Pro',stats.pro,'#00d4aa'],['Elite',stats.elite,'#e3b341']].map(([l,v,c])=>(
          <div key={l as string} style={card}>
            <div style={{ fontSize:'10px', color:'#8b949e', textTransform:'uppercase', marginBottom:'6px' }}>{l}</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:c as string }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search by email..."
          style={{ flex:1, minWidth:'220px', padding:'10px 14px', background:'#161b22', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'13px', outline:'none' }}/>
        <select value={filterTier} onChange={e=>setFilterTier(e.target.value)}
          style={{ padding:'10px 14px', background:'#161b22', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'13px', cursor:'pointer' }}>
          <option value="all">All Tiers</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="elite">Elite</option>
        </select>
        <button onClick={loadUsers} style={{ padding:'10px 16px', background:'#21262d', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'13px', cursor:'pointer' }}>🔄 Refresh</button>
      </div>

      <div style={{ ...card, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid #21262d', fontSize:'13px', fontWeight:'600', color:'#e6edf3' }}>Users ({filtered.length})</div>
        <div style={{ overflowX:'auto', maxHeight:'600px', overflowY:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#0d1117', position:'sticky', top:0 }}>
                {['Email','Tier','Expires','Grant Access'].map(h=>(
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', color:'#8b949e', fontWeight:'600', textTransform:'uppercase', borderBottom:'1px solid #21262d', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const tier = u.subscription_tier
                const tc = tier==='elite'?'#e3b341':tier==='pro'?'#00d4aa':'#8b949e'
                return (
                  <tr key={u.id} style={{ borderBottom:'1px solid #21262d' }}>
                    <td style={{ padding:'10px 16px' }}>
                      <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{u.email}</div>
                      {u.is_admin && <span style={{ fontSize:'9px', color:'#e3b341' }}>👑 admin</span>}
                    </td>
                    <td style={{ padding:'10px 16px' }}>
                      <span style={{ background:`${tc}22`, color:tc, fontSize:'10px', padding:'3px 10px', borderRadius:'12px', fontWeight:'700', textTransform:'uppercase' }}>{tier}</span>
                    </td>
                    <td style={{ padding:'10px 16px', fontSize:'11px', color:'#8b949e' }}>{fmt(u.subscription_ends_at)}</td>
                    <td style={{ padding:'10px 16px' }}>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        <button onClick={()=>setTier(u.id,'pro',30,u.email)} style={{ background:'rgba(0,212,170,0.15)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'5px', padding:'4px 8px', color:'#00d4aa', fontSize:'10px', cursor:'pointer', fontWeight:'600' }}>Pro 30d</button>
                        <button onClick={()=>setTier(u.id,'pro',90,u.email)} style={{ background:'rgba(0,212,170,0.15)', border:'1px solid rgba(0,212,170,0.3)', borderRadius:'5px', padding:'4px 8px', color:'#00d4aa', fontSize:'10px', cursor:'pointer', fontWeight:'600' }}>Pro 90d</button>
                        <button onClick={()=>setTier(u.id,'elite',30,u.email)} style={{ background:'rgba(227,179,65,0.15)', border:'1px solid rgba(227,179,65,0.3)', borderRadius:'5px', padding:'4px 8px', color:'#e3b341', fontSize:'10px', cursor:'pointer', fontWeight:'600' }}>Elite 30d</button>
                        <button onClick={()=>setTier(u.id,'elite',null,u.email)} style={{ background:'rgba(227,179,65,0.15)', border:'1px solid rgba(227,179,65,0.3)', borderRadius:'5px', padding:'4px 8px', color:'#e3b341', fontSize:'10px', cursor:'pointer', fontWeight:'600' }}>Elite ∞</button>
                        <button onClick={()=>setTier(u.id,'free',null,u.email)} style={{ background:'rgba(248,81,73,0.1)', border:'1px solid rgba(248,81,73,0.3)', borderRadius:'5px', padding:'4px 8px', color:'#f85149', fontSize:'10px', cursor:'pointer' }}>Free</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ height:'40px' }}/>
    </div>
  )
}
