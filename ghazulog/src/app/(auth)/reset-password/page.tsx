'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState(false)
  const [ready,     setReady]     = useState(false)
  const [checking,  setChecking]  = useState(true)

  useEffect(() => {
    async function handleRecovery() {
      const url = new URL(window.location.href)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))

      // 1. token_hash + type=recovery (newest Supabase flow)
      const token_hash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      if (token_hash && type === 'recovery') {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
        if (!error) { setReady(true); setChecking(false); return }
      }

      // 2. code param (PKCE flow)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) { setReady(true); setChecking(false); return }
      }

      // 3. access_token in hash (implicit flow)
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        if (!error) { setReady(true); setChecking(false); return }
      }

      // 4. Already has a session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) { setReady(true); setChecking(false); return }

      // 5. Listen for recovery event as fallback
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
          setReady(true); setChecking(false)
        }
      })

      // Give it a moment then stop checking
      setTimeout(() => setChecking(false), 2000)
    }
    handleRecovery()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6)  { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setTimeout(()=>router.push('/dashboard'), 2000) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'-apple-system,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:'400px', padding:'0 20px' }}>
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <div style={{ width:'56px', height:'56px', background:'#00d4aa', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', fontSize:'24px', fontWeight:'700', color:'#0d1117' }}>G</div>
          <h1 style={{ fontSize:'26px', fontWeight:'700', color:'#e6edf3', margin:'0 0 6px' }}>GhazuLog</h1>
          <p style={{ color:'#8b949e', fontSize:'14px', margin:0 }}>Set a new password</p>
        </div>

        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'12px', padding:'32px' }}>
          {checking ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'32px', marginBottom:'12px' }}>⏳</div>
              <p style={{ color:'#8b949e', fontSize:'13px' }}>Verifying reset link...</p>
            </div>
          ) : success ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>✅</div>
              <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 8px' }}>Password updated!</h2>
              <p style={{ color:'#8b949e', fontSize:'13px' }}>Redirecting to dashboard...</p>
            </div>
          ) : !ready ? (
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:'32px', marginBottom:'12px' }}>⚠️</div>
              <h2 style={{ fontSize:'16px', fontWeight:'600', color:'#e6edf3', margin:'0 0 8px' }}>Invalid or expired link</h2>
              <p style={{ color:'#8b949e', fontSize:'13px', marginBottom:'16px' }}>This reset link is invalid or has expired. Request a new one.</p>
              <button onClick={()=>router.push('/forgot-password')}
                style={{ width:'100%', padding:'11px', background:'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>
                Request New Link
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize:'18px', fontWeight:'600', color:'#e6edf3', margin:'0 0 20px' }}>Create new password</h2>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom:'14px' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'6px' }}>New Password</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Min. 6 characters" required
                    style={{ width:'100%', padding:'10px 14px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }}/>
                </div>
                <div style={{ marginBottom:'20px' }}>
                  <label style={{ display:'block', fontSize:'13px', fontWeight:'500', color:'#e6edf3', marginBottom:'6px' }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" required
                    style={{ width:'100%', padding:'10px 14px', background:'#0d1117', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', fontSize:'14px', outline:'none', boxSizing:'border-box' as const }}/>
                </div>
                {error && <div style={{ background:'#3d0f0f', border:'1px solid #f85149', borderRadius:'8px', padding:'10px 14px', color:'#f85149', fontSize:'13px', marginBottom:'16px' }}>{error}</div>}
                <button type="submit" disabled={loading}
                  style={{ width:'100%', padding:'11px', background: loading?'#0a8a6e':'#00d4aa', color:'#0d1117', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor: loading?'not-allowed':'pointer' }}>
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
