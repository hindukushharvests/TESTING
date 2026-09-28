'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfirmedPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<'verifying'|'success'|'error'>('verifying')

  useEffect(() => {
    async function confirm() {
      const url = new URL(window.location.href)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))

      // token_hash flow (newest)
      const token_hash = url.searchParams.get('token_hash')
      const type = url.searchParams.get('type')
      if (token_hash && (type === 'signup' || type === 'email')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash, type: 'signup' })
        setStatus(error ? 'error' : 'success')
        return
      }

      // code flow (PKCE)
      const code = url.searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        setStatus(error ? 'error' : 'success')
        return
      }

      // hash token flow
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token })
        setStatus(error ? 'error' : 'success')
        return
      }

      // Already has session?
      const { data: { session } } = await supabase.auth.getSession()
      setStatus(session ? 'success' : 'error')
    }
    confirm()
  }, [])

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'-apple-system,sans-serif', padding:'20px' }}>
      <div style={{ width:'100%', maxWidth:'420px', textAlign:'center' }}>
        <img src="/logo-h.png" alt="GhazuLog" style={{ height:'40px', marginBottom:'32px' }} onError={e=>{(e.target as any).style.display='none'}}/>

        <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'16px', padding:'40px 32px' }}>
          {status === 'verifying' && (
            <>
              <div style={{ width:'48px', height:'48px', border:'4px solid #21262d', borderTopColor:'#00d4aa', borderRadius:'50%', margin:'0 auto 20px', animation:'spin 0.8s linear infinite' }}/>
              <div style={{ fontSize:'16px', color:'#e6edf3', fontWeight:'600' }}>Confirming your email...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{ fontSize:'56px', marginBottom:'16px' }}>🎉</div>
              <h1 style={{ fontSize:'24px', fontWeight:'800', color:'#3fb950', margin:'0 0 10px' }}>Account Created!</h1>
              <p style={{ color:'#8b949e', fontSize:'14px', lineHeight:'1.6', margin:'0 0 28px' }}>
                Your email is confirmed and your GhazuLog account is ready. Welcome aboard — let's start journaling those trades!
              </p>
              <button onClick={()=>router.push('/dashboard')}
                style={{ width:'100%', padding:'13px', background:'linear-gradient(135deg,#00d4aa,#009980)', border:'none', borderRadius:'10px', color:'#0d1117', fontSize:'15px', fontWeight:'700', cursor:'pointer', marginBottom:'10px' }}>
                Go to Dashboard →
              </button>
              <button onClick={()=>router.push('/login')}
                style={{ background:'none', border:'none', color:'#8b949e', fontSize:'13px', cursor:'pointer' }}>
                Or log in here
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>⚠️</div>
              <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e6edf3', margin:'0 0 10px' }}>Confirmation Issue</h1>
              <p style={{ color:'#8b949e', fontSize:'14px', lineHeight:'1.6', margin:'0 0 24px' }}>
                This link may have expired or already been used. If your account is confirmed, just log in. Otherwise request a new confirmation email.
              </p>
              <button onClick={()=>router.push('/login')}
                style={{ width:'100%', padding:'13px', background:'#00d4aa', border:'none', borderRadius:'10px', color:'#0d1117', fontSize:'15px', fontWeight:'700', cursor:'pointer', marginBottom:'10px' }}>
                Go to Login →
              </button>
              <button onClick={()=>router.push('/signup')}
                style={{ background:'none', border:'none', color:'#8b949e', fontSize:'13px', cursor:'pointer' }}>
                Sign up again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
