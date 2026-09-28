'use client'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e6edf3', fontFamily: "'Sora', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      {/* NAV */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 32px', borderBottom: '1px solid #21262d', position: 'sticky', top: 0, background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(10px)', zIndex: 50 }}>
        <Link href="/landing" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
          <img src="/logo-h.png" alt="GhazuLog" style={{ height: 30 }} onError={(e:any)=>{e.target.style.display='none'}} />
        </Link>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Link href="/landing" style={{ color: '#8b949e', textDecoration: 'none', fontSize: 14 }}>Home</Link>
          <Link href="/pricing" style={{ color: '#8b949e', textDecoration: 'none', fontSize: 14 }}>Pricing</Link>
          <Link href="/signup" style={{ background: '#00d4aa', color: '#0d1117', padding: '9px 20px', borderRadius: 100, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Start Free →</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '64px 24px 100px' }}>
        {/* HERO */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,230,184,0.08)', border: '1px solid #21262d', padding: '7px 16px', borderRadius: 100, fontSize: 12, color: '#2dd4bf', fontFamily: "'JetBrains Mono', monospace", marginBottom: 24 }}>
            <span style={{ width: 7, height: 7, background: '#2dd4bf', borderRadius: '50%', boxShadow: '0 0 10px #2dd4bf' }} /> ABOUT GHAZULOG
          </div>
          <h1 style={{ fontSize: 'clamp(34px, 6vw, 52px)', fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1, margin: '0 0 16px' }}>
            Built by a trader,<br /><span style={{ background: 'linear-gradient(120deg, #2dd4bf, #d4af37)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>for traders.</span>
          </h1>
          <p style={{ color: '#8b949e', fontSize: 18, maxWidth: 560, margin: '0 auto', lineHeight: 1.6 }}>
            Engineered for execution, behavioral clarity, and long-term consistency.
          </p>
        </div>

        {/* FOUNDER CARD */}
        <div style={{ background: 'rgba(22,27,34,0.6)', border: '1px solid #21262d', borderRadius: 20, padding: 36, marginBottom: 48, backdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
            <img src="/founder.jpg" alt="Ghazanfar Ali, Founder of GhazuLog" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2dd4bf', flexShrink: 0 }} onError={(e:any)=>{ e.target.style.display='none' }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>Ghazanfar Ali</div>
              <div style={{ color: '#2dd4bf', fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>Founder, GhazuLog</div>
            </div>
          </div>

          <blockquote style={{ borderLeft: '3px solid #d4af37', paddingLeft: 18, margin: '0 0 28px', fontSize: 19, fontStyle: 'italic', color: '#e6edf3', lineHeight: 1.5 }}>
            &ldquo;Trading isn&apos;t a game of guessing—it&apos;s a discipline of data, risk control, and self-mastery.&rdquo;
          </blockquote>

          <div style={{ color: '#c9d1d9', fontSize: 15.5, lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0 }}>Hi, I&apos;m Ghazanfar Ali, Founder of GhazuLog.</p>
            <p style={{ margin: 0 }}>Over the last 5 years active in the financial markets, I&apos;ve experienced every phase of a trader&apos;s journey—from the high of winning streaks to the hard-learned lessons of drawdowns, emotional mistakes, and broken rules.</p>
            <p style={{ margin: 0 }}>Through thousands of hours on the charts, one core truth became undeniable: the trading setup is rarely the problem—human psychology, execution drift, and unmanaged risk are.</p>
            <p style={{ margin: 0 }}>When I looked for software to journal and analyze my own execution, I found traditional options were either clunky, visually outdated, or treated trade logging like a manual chore. None of them offered the clean, fast, and psychologically focused experience active traders need to protect their capital.</p>
            <p style={{ margin: 0 }}>I built GhazuLog to eliminate that friction. What started as a tool engineered for my own daily routines has evolved into a high-performance workspace designed to help traders transform raw execution data into a sustainable competitive edge.</p>
          </div>
        </div>

        {/* PHILOSOPHY */}
        <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 20, textAlign: 'center' }}>Our Core Philosophy</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 48 }}>
          {[
            ['📈', 'Process Over Short-Term P&L', 'True profitability comes from system discipline, risk-to-reward management, and rules adherence—not short-term luck.'],
            ['⚡', 'Frictionless Data Ingestion', "Journaling shouldn't take longer than trading. We prioritize rapid CSV parsing and automated mapping so you spend time analyzing performance, not typing numbers."],
            ['🧠', 'Behavioral Intelligence', 'We focus on identifying psychological leaks—pinpointing setups driven by FOMO, revenge trading, or session fatigue before they drain your account.'],
            ['🔒', 'Strict Data Privacy & Security', 'Your trading strategies, history, and financial metrics belong strictly to you. Your data remains fully private and encrypted.'],
          ].map(([icon, title, body]) => (
            <div key={title} style={{ background: 'rgba(22,27,34,0.6)', border: '1px solid #21262d', borderRadius: 16, padding: 24, backdropFilter: 'blur(8px)' }}>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</div>
              <div style={{ color: '#8b949e', fontSize: 14, lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>

        {/* BUILT FOR SERIOUS TRADERS */}
        <div style={{ background: 'linear-gradient(180deg, rgba(0,230,184,0.05), rgba(22,27,34,0.4))', border: '1px solid #21262d', borderRadius: 20, padding: 36, marginBottom: 48 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', margin: '0 0 8px' }}>Built for Serious Traders</h2>
          <p style={{ color: '#8b949e', fontSize: 14.5, margin: '0 0 24px' }}>Whether you&apos;re managing personal capital, scaling prop-firm challenges, or backtesting a new edge, GhazuLog provides:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Instant Import Engine', 'Seamlessly process bulk trade files from major brokers.'],
              ['Prop-Firm Safeguards', 'Real-time monitoring of daily drawdown limits and account parameters.'],
              ['Behavioral Tagging', 'Correlate emotional states and setups with actual statistical performance.'],
              ['Dynamic Analytics', 'Clean, interactive dashboards that reveal your true equity curve and risk metrics.'],
            ].map(([t, d]) => (
              <div key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{ color: '#2dd4bf', fontWeight: 700, fontSize: 16, lineHeight: 1.4 }}>✓</span>
                <div><span style={{ fontWeight: 600, fontSize: 15 }}>{t}:</span> <span style={{ color: '#8b949e', fontSize: 14.5 }}>{d}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* CLOSING NOTE */}
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>A Note From Ghazanfar</h2>
          <p style={{ color: '#c9d1d9', fontSize: 15.5, lineHeight: 1.7, maxWidth: 620, margin: '0 auto 24px' }}>
            GhazuLog is actively built and continuously updated based on feedback from traders who live in the charts every day. If you have a feature request, feedback, or a broker integration you&apos;d like to see, reach out to me directly.
          </p>
          <a href="https://twitter.com/Ghazulog" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,230,184,0.1)', border: '1px solid #2dd4bf', color: '#2dd4bf', padding: '11px 22px', borderRadius: 100, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Reach out on X → @Ghazulog
          </a>
          <div style={{ marginTop: 40, paddingTop: 28, borderTop: '1px solid #21262d' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Ghazanfar Ali</div>
            <div style={{ color: '#8b949e', fontSize: 13, marginTop: 2 }}>Founder, GhazuLog · ghazulog.com</div>
            <Link href="/signup" style={{ display: 'inline-block', marginTop: 24, background: '#00d4aa', color: '#0d1117', padding: '13px 30px', borderRadius: 100, textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>Start Free Today →</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
