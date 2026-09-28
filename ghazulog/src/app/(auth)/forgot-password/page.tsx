'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ghazulog.com/reset-password'
    })
    if (error) { setError(error.message); setLoading(false) }
    else { setSent(true); setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'-apple-system,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'400px', padding:'0 20px' }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ width:'56px', height:'56px', background:'#00d4aa', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:'24px', fontWeight:'700', color:'#0d1117' }}>G</div>
          <h1 style={{ fontSize:'26px', fontWeight:'700', color:'#e6edf3', margin:'0 0 6px' }}>GhazuLog</h1>
          <p style={{ color:'#8b949e', fontSize:'14px', margin:0 }}>Reset your password</p>
        </div>

        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'12px', padding:'32px' }}>
          {sent ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'40px', marginBottom:'16px' }}>📧</div>
              <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 10px' }}>Check your email!</h2>
              <p style={{ color:'#8b949e', fontSize:'14px', lineHeight:'1.6', margin:'0 0 20px' }}>
                We sent a password reset link to<br/>
                <strong style={{ color:'#00d4aa' }}>{email}</strong>
              </p>
              <a href="/login" style={{ display:'block', padding:'10px', background:'#00d4aa', color:'#0d1117', borderRadius:'8px', fontSize:'13px', fontWeight:'600', textDecoration:'none', textAlign:'center' }}>
                Back to Login
              </a>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 8px' }}>Forgot your password?</h2>
              <p style={{ color:'#8b949e', fontSize:'13px', margin:'0 0 20px' }}>Enter your email and we'll send you a reset link.</p>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'6px' }}>Email</label>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required
                    style={{ width:'100%', padding:'10px 14px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }}/>
                </div>

                {error && (
                  <div style={{ background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'8px', padding:'10px 14px', color:'#f85149', fontSize:'13px', marginBottom:'16px' }}>{error}</div>
                )}

                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'11px', background: loading?'#0a8a6e':'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor: loading?'not-allowed':'pointer' }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>

              <p style={{ textAlign:'center', marginTop:'20px', fontSize:'13px', color:'#8b949e' }}>
                Remember it? <a href="/login" style={{ color:'#00d4aa', textDecoration:'none', fontWeight:'500' }}>Sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
