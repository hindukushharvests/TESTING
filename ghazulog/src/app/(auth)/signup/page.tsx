'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router   = useRouter()
  const supabase = createClient()
  const [fullName,  setFullName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })
      if (error) { setError(error.message); setLoading(false); return }
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'10px 14px',
    background:'#0d1117', border:'1px solid #30363d',
    borderRadius:'8px', color:'#e6edf3',
    fontSize:'14px', outline:'none', boxSizing:'border-box'
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'-apple-system,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'400px', padding:'0 20px' }}>

        <div style={{ textAlign:'center', marginBottom:'36px' }}>
          <img src="/logo-icon.png" alt="G" style={{ height:'48px', objectFit:'contain', marginBottom:'12px', display:'block', margin:'0 auto 12px' }}
            onError={e=>{ const el=e.target as HTMLImageElement; el.style.display='none' }}/>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>GhazuLog</h1>
          <p style={{ color:'#8b949e', fontSize:'13px', margin:0 }}>Free trading journal for serious traders</p>
        </div>

        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'12px', padding:'28px' }}>
          {success ? (
            <div style={{ textAlign:'center', padding:'20px 0' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>🎉</div>
              <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 8px' }}>Account created!</h2>
              <p style={{ color:'#8b949e', fontSize:'13px' }}>Redirecting to dashboard...</p>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 20px' }}>Create your free account</h2>
              <form onSubmit={handleSignup}>
                {[
                  { label:'Full Name', type:'text', value:fullName, set:setFullName, ph:'Ghazanfar Ali' },
                  { label:'Email', type:'email', value:email, set:setEmail, ph:'you@example.com' },
                  { label:'Password', type:'password', value:password, set:setPassword, ph:'Min. 6 characters' },
                  { label:'Confirm Password', type:'password', value:confirm, set:setConfirm, ph:'••••••••' },
                ].map(f => (
                  <div key={f.label} style={{ marginBottom:'14px' }}>
                    <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'6px' }}>{f.label}</label>
                    <input type={f.type} value={f.value} onChange={e=>f.set(e.target.value)}
                      placeholder={f.ph} required style={inp}/>
                  </div>
                ))}

                {error && (
                  <div style={{ background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'8px', padding:'10px 14px', color:'#f85149', fontSize:'13px', marginBottom:'16px' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'11px', background:loading?'#0a8a6e':'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:loading?'not-allowed':'pointer' }}>
                  {loading ? 'Creating account...' : 'Create free account'}
                </button>
              </form>

              <p style={{ textAlign:'center', marginTop:'18px', fontSize:'13px', color:'#8b949e' }}>
                Already have an account? <a href="/login" style={{ color:'#00d4aa', textDecoration:'none', fontWeight:'500' }}>Sign in</a>
              </p>
            </>
          )}
        </div>

        <p style={{ textAlign:'center', marginTop:'16px', fontSize:'12px', color:'#8b949e' }}>
          Free forever · No credit card needed
        </p>
      </div>
    </div>
  )
}
