'use client'

import { useEffect, useState, useRef } from 'react'
import UsageLimitBanner from '@/components/UsageLimitBanner'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { icon: '▦', label: 'Dashboard',   path: '/dashboard' },
  { icon: '📓', label: 'Journal',     path: '/journal' },
  { icon: '📊', label: 'Reports',     path: '/reports' },
  { icon: '📚', label: 'Playbooks',   path: '/playbooks' },
  { icon: '🔬', label: 'Backtest',    path: '/backtest' },
  { icon: '📅', label: 'Economic Calendar', path: '/replay' },
  { icon: '🏢', label: 'Prop Firms',  path: '/prop-firms' },
  { icon: '🤖', label: 'AI Insights', path: '/ai-insights' },
  { icon: '📥', label: 'Import',      path: '/import' }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [user, setUser]           = useState<any>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login')
      } else {
        setUser(data.user)
        setLoading(false)
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo-h.png" alt="GhazuLog" style={{ height: '40px', objectFit: 'contain', margin: '0 auto 16px', display: 'block' }}/>
          <p style={{ color: '#8b949e', fontSize: '14px' }}>Loading GhazuLog...</p>
        </div>
      </div>
    )
  }

  const sidebarW = collapsed ? '60px' : '220px'
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Trader'
  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      background: 'transparent',
      position: 'relative',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <div aria-hidden style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        backgroundImage:'url("/logo-icon.png")',
        backgroundRepeat:'no-repeat',
        backgroundPosition:'center center',
        backgroundSize:'420px auto',
        opacity:0.09
      }} />

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: sidebarW,
        minHeight: '100vh',
        background: '#0d1117',
        borderRight: '1px solid #21262d',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
        overflow: 'hidden'
      }}>

        {/* Logo */}
        <div style={{
          padding: collapsed ? '16px 0' : '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderBottom: '1px solid #21262d',
          justifyContent: collapsed ? 'center' : 'flex-start'
        }}>
          {collapsed ? (
            <img src="/logo-icon.png" alt="G" style={{ width:'32px', height:'32px', objectFit:'contain', flexShrink:0 }}
              onError={(e:any)=>{ e.target.style.display='none'; e.target.insertAdjacentHTML('afterend','<div style="width:32px;height:32px;background:#00d4aa;borderRadius:8px;display:flex;alignItems:center;justifyContent:center;fontSize:16px;fontWeight:700;color:#0d1117;flexShrink:0">G</div>') }}/>
          ) : (
            <img src="/logo-h.png" alt="GhazuLog" style={{ height:'32px', objectFit:'contain', maxWidth:'160px' }}
              onError={(e:any)=>{ e.target.style.display='none'; e.target.insertAdjacentHTML('afterend','<span style="fontSize:16px;fontWeight:700;color:#e6edf3;whiteSpace:nowrap">GhazuLog</span>') }}/>
          )}
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {navItems.map(item => {
            const isActive = pathname === item.path ||
              (item.path !== '/dashboard' && pathname.startsWith(item.path))
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                title={collapsed ? item.label : ''}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: collapsed ? '10px 0' : '10px 14px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? '#161b22' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid #00d4aa' : '2px solid transparent',
                  borderRadius: collapsed ? '0' : '0 8px 8px 0',
                  cursor: 'pointer',
                  color: isActive ? '#e6edf3' : '#8b949e',
                  fontSize: '13px',
                  fontWeight: isActive ? '500' : '400',
                  transition: 'all 0.15s',
                  marginBottom: '2px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && item.label}
              </button>
            )
          })}
        </nav>

        {/* Bottom — User + Collapse */}
        <div style={{ borderTop: '1px solid #21262d', padding: '8px' }}>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#8b949e',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: collapsed ? 'center' : 'flex-end',
              marginBottom: '8px'
            }}
          >
            {collapsed ? '→' : '←'}
          </button>

          {/* User */}
          {!collapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px',
              background: '#161b22',
              borderRadius: '8px'
            }}>
              <div style={{
                width: '30px', height: '30px',
                background: '#533AB7',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: '11px', fontWeight: '600',
                color: '#afa9ec', flexShrink: 0
              }}>{initials}</div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{
                  fontSize: '12px', fontWeight: '500',
                  color: '#e6edf3',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{userName}</div>
                <div style={{
                  fontSize: '10px', color: '#8b949e',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>{user?.email}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Sign out"
                style={{
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', color: '#8b949e',
                  fontSize: '14px', padding: '4px',
                  flexShrink: 0
                }}
              >⎋</button>
            </div>
          )}

          {collapsed && (
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                width: '100%', padding: '8px',
                background: 'transparent', border: 'none',
                cursor: 'pointer', color: '#8b949e', fontSize: '16px'
              }}
            >⎋</button>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main style={{
        flex: 1,
        marginLeft: sidebarW,
        transition: 'margin-left 0.2s ease',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 1
      }}>

        {/* Topbar */}
        <header style={{
          height: '52px',
          background: '#161b22',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '12px',
          position: 'sticky',
          top: 0, zIndex: 50
        }}>
          <span style={{
            fontSize: '14px', fontWeight: '500',
            color: '#e6edf3', flex: 1
          }}>
            {navItems.find(n => pathname === n.path ||
              (n.path !== '/dashboard' && pathname.startsWith(n.path)))?.label || 'Dashboard'}
          </span>

          {/* Market badges */}
          {['Stocks', 'Forex', 'Crypto'].map(m => (
            <span key={m} style={{
              fontSize: '11px',
              background: '#21262d',
              color: '#8b949e',
              borderRadius: '20px',
              padding: '3px 10px'
            }}>{m}</span>
          ))}

          {/* Add Trade button */}
          <button
            onClick={() => router.push('/journal')}
            style={{
              padding: '7px 14px',
              background: '#00d4aa',
              color: '#0d1117',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            + Add Trade
          </button>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, padding: '20px' }}>
          <UsageLimitBanner />
          {children}
        </div>
      </main>
    </div>
  )
}