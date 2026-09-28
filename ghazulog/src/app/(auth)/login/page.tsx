'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    background: '#0d1117', border: '1px solid #30363d',
    borderRadius: '8px', color: '#e6edf3',
    fontSize: '14px', outline: 'none', boxSizing: 'border-box'
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'-apple-system,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'400px', padding:'0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <img src="/logo-icon.png" alt="G" style={{ height:'48px', objectFit:'contain', marginBottom:'12px', display:'block', margin:'0 auto 12px' }}
            onError={e=>{ const el=e.target as HTMLImageElement; el.style.display='none' }}/>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>GhazuLog</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>Track. Analyze. Improve.</p>
        </div>

        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'12px', padding:'28px' }}>
          <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 20px' }}>Sign in to your account</h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'6px' }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="you@example.com" required style={inp}/>
            </div>

            <div style={{ marginBottom:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <label style={{ fontSize:'13px', fontWeight:'500', color:'#e6edf3' }}>Password</label>
                <a href="/forgot-password" style={{ fontSize:'12px', color:'#00d4aa', textDecoration:'none' }}>Forgot password?</a>
              </div>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••" required style={inp}/>
            </div>

            {error && (
              <div style={{ background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'8px', padding:'10px 14px', color:'#f85149', fontSize:'13px', marginBottom:'16px' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'11px', background: loading?'#0a8a6e':'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor: loading?'not-allowed':'pointer' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:'18px', fontSize:'13px', color:'#8b949e' }}>
            No account? <a href="/signup" style={{ color:'#00d4aa', textDecoration:'none', fontWeight:'500' }}>Create one free</a>
          </p>
        </div>

        <p style={{ textAlign:'center', marginTop:'16px', fontSize:'12px', color:'#8b949e' }}>
          Free forever · No credit card needed
        </p>
      </div>
    </div>
  )
}
