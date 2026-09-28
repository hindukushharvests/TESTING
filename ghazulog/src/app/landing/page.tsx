'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

const FEATURES_TICKER = [
  ['📊', 'Performance Analytics', '50+ reports'],
  ['📓', 'Trade Journal', 'log everything'],
  ['🧠', 'AI Insights', 'built-in'],
  ['🔬', 'Backtesting', 'years of data'],
  ['📚', 'Smart Playbooks', 'track your edge'],
  ['🏢', 'Prop Firm Tracker', 'live drawdown'],
  ['⚡', 'One-Click Import', 'MT4 · MT5 · Binance'],
  ['📅', 'Calendar Reports', 'day/month/year'],
  ['💹', 'Win Rate & PF', 'auto-calc'],
  ['🎯', 'Setup Tagging', 'find what works'],
]

const COMPARE = [
  ['Trades per day', '10', 'Unlimited', 'Unlimited'],
  ['Trade journal', true, true, true],
  ['Performance analytics', true, true, true],
  ['AI Insights', true, true, true],
  ['Gemini Deep AI', false, true, true],
  ['Calendar reports', true, true, true],
  ['CSV import', '1/day', '10/day', 'Unlimited'],
  ['Backtesting', true, true, true],
  ['Smart Playbooks', false, true, true],
  ['CSV export', false, true, true],
  ['Prop Firm Tracker', false, false, true],
  ['Pass-probability AI', false, false, true],
  ['API access', false, false, true],
  ['Priority support', false, false, true],
] as const

export default function LandingPage() {
  const [tier, setTier] = useState<'free' | 'pro' | 'elite'>('pro')
  const spiralRef = useRef<HTMLCanvasElement>(null)
  const bgRef = useRef<HTMLCanvasElement>(null)
  const candleRef = useRef<HTMLCanvasElement>(null)
  const [threeReady, setThreeReady] = useState(false)

  const f1 = useInView(); const f2 = useInView(); const f3 = useInView()
  const f4 = useInView(); const f5 = useInView(); const f6 = useInView()
  const cmp = useInView(); const ins = useInView(); const prc = useInView(); const cta = useInView()

  // Candlesticks (canvas 2D, no WebGL)
  useEffect(() => {
    const cc = candleRef.current; if (!cc) return
    const ctx = cc.getContext('2d'); if (!ctx) return
    let data: { open: number; close: number; high: number; low: number }[] = []
    let off = 0; let raf = 0
    function init() {
      cc!.width = window.innerWidth; cc!.height = 180
      data = []; let price = 100
      const n = Math.floor(cc!.width / 14)
      for (let i = 0; i < n; i++) {
        const open = price; price += (Math.random() - 0.48) * 8
        const close = price
        data.push({ open, close, high: Math.max(open, close) + Math.random() * 3, low: Math.min(open, close) - Math.random() * 3 })
      }
    }
    function draw() {
      ctx!.clearRect(0, 0, cc!.width, cc!.height)
      const ps = data.flatMap(c => [c.high, c.low])
      const mn = Math.min(...ps), mx = Math.max(...ps), rng = mx - mn || 1
      const y = (v: number) => cc!.height - ((v - mn) / rng) * (cc!.height - 30) - 15
      data.forEach((c, i) => {
        const x = i * 14 + 7 + off; const up = c.close >= c.open
        ctx!.strokeStyle = up ? 'rgba(0,230,184,0.7)' : 'rgba(255,93,87,0.6)'
        ctx!.fillStyle = up ? 'rgba(0,230,184,0.55)' : 'rgba(255,93,87,0.4)'
        ctx!.lineWidth = 1
        ctx!.beginPath(); ctx!.moveTo(x, y(c.high)); ctx!.lineTo(x, y(c.low)); ctx!.stroke()
        const top = y(Math.max(c.open, c.close)), h = Math.abs(y(c.open) - y(c.close)) || 1
        ctx!.fillRect(x - 4, top, 8, h)
      })
    }
    function loop() { off -= 0.3; if (off < -14) { off = 0; data.push(data.shift()!) } draw(); raf = requestAnimationFrame(loop) }
    init(); loop()
    const onResize = () => init()
    window.addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) }
  }, [])

  // Three.js scenes (spiral + bg particles) — init after script loads
  useEffect(() => {
    if (!threeReady) return
    const THREE = (window as any).THREE
    if (!THREE) return
    const cleanups: (() => void)[] = []

    // SPIRAL
    try {
      const canvas = spiralRef.current
      if (!canvas) throw new Error('spiral canvas removed')
      const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      const scene = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100); cam.position.z = 11
      const group = new THREE.Group(); scene.add(group)
      const teal = new THREE.MeshStandardMaterial({ color: 0x00e6b8, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.85, emissive: 0x00604d, emissiveIntensity: 0.4 })
      const gold = new THREE.MeshStandardMaterial({ color: 0xe3b341, roughness: 0.2, metalness: 0.4, transparent: true, opacity: 0.8, emissive: 0x4a3a10, emissiveIntensity: 0.3 })
      const glass = new THREE.MeshStandardMaterial({ color: 0x1a3a33, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 })
      const perTurn = 10, total = 3 * perTurn
      for (let i = 0; i < total; i++) {
        const a = (i / perTurn) * Math.PI * 2; const yy = (i / total - 0.5) * 9
        for (let s = 0; s < 2; s++) {
          const ang = a + s * Math.PI
          const sph = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), s === 0 ? teal : gold)
          sph.position.set(Math.cos(ang) * 1.9, yy, Math.sin(ang) * 1.9); group.add(sph)
        }
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), glass); c.position.y = yy; group.add(c)
      }
      const l1 = new THREE.PointLight(0x00e6b8, 1.2, 50); l1.position.set(5, 5, 8); scene.add(l1)
      const l2 = new THREE.PointLight(0xe3b341, 0.8, 50); l2.position.set(-5, -3, 6); scene.add(l2)
      scene.add(new THREE.AmbientLight(0x335544, 0.6))
      let mx = 0, my = 0, tx = 0, ty = 0, raf = 0
      const onMove = (e: MouseEvent) => { mx = (e.clientX / window.innerWidth - 0.5); my = (e.clientY / window.innerHeight - 0.5) }
      document.addEventListener('mousemove', onMove)
      const size = () => { const rect = canvas.parentElement!.getBoundingClientRect(); r.setSize(rect.width, rect.height); r.setPixelRatio(Math.min(devicePixelRatio, 2)); cam.aspect = rect.width / rect.height; cam.updateProjectionMatrix() }
      const anim = () => { tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05; group.rotation.y += 0.002 + tx * 0.01; group.rotation.x = ty * 0.25; r.render(scene, cam); raf = requestAnimationFrame(anim) }
      size(); anim()
      // Re-measure after layout settles (desktop grid can report 0 on first paint)
      requestAnimationFrame(size)
      setTimeout(size, 100)
      setTimeout(size, 400)
      setTimeout(size, 1000)
      const onResize = () => size()
      window.addEventListener('resize', onResize)
      cleanups.push(() => { cancelAnimationFrame(raf); document.removeEventListener('mousemove', onMove); window.removeEventListener('resize', onResize); r.dispose() })
    } catch (e) { console.warn('spiral webgl', e) }

    // BG PARTICLES
    try {
      const canvas = bgRef.current!
      const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
      r.setSize(window.innerWidth, window.innerHeight); r.setPixelRatio(Math.min(devicePixelRatio, 2))
      const scene = new THREE.Scene()
      const cam = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000); cam.position.z = 30
      const PC = 600; const pos = new Float32Array(PC * 3); const vel: number[] = []
      for (let i = 0; i < PC; i++) { pos[i * 3] = (Math.random() - 0.5) * 90; pos[i * 3 + 1] = (Math.random() - 0.5) * 70; pos[i * 3 + 2] = (Math.random() - 0.5) * 50; vel.push((Math.random() - 0.5) * 0.015) }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      const mat = new THREE.PointsMaterial({ color: 0x00e6b8, size: 0.2, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending })
      const points = new THREE.Points(geo, mat); scene.add(points)
      let sx = 0, sy = 0, tx = 0, ty = 0, scrollY = 0, raf = 0
      const onMove = (e: MouseEvent) => { sx = (e.clientX / window.innerWidth - 0.5); sy = (e.clientY / window.innerHeight - 0.5) }
      const onScroll = () => { scrollY = window.scrollY }
      document.addEventListener('mousemove', onMove); window.addEventListener('scroll', onScroll)
      const anim = () => {
        const p = geo.attributes.position.array as Float32Array
        for (let i = 0; i < PC; i++) { p[i * 3 + 1] += vel[i]; if (p[i * 3 + 1] > 35) p[i * 3 + 1] = -35; if (p[i * 3 + 1] < -35) p[i * 3 + 1] = 35 }
        geo.attributes.position.needsUpdate = true
        tx += (sx - tx) * 0.02; ty += (sy - ty) * 0.02
        points.rotation.y += 0.0003; cam.position.y = -scrollY * 0.006; cam.position.x = tx * 1; cam.lookAt(0, cam.position.y * 0.5, 0)
        r.render(scene, cam); raf = requestAnimationFrame(anim)
      }
      anim()
      const onResize = () => { r.setSize(window.innerWidth, window.innerHeight); cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix() }
      window.addEventListener('resize', onResize)
      cleanups.push(() => { cancelAnimationFrame(raf); document.removeEventListener('mousemove', onMove); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); r.dispose() })
    } catch (e) { console.warn('bg webgl', e) }

    return () => cleanups.forEach(fn => fn())
  }, [threeReady])

  const cell = (v: boolean | string) => v === true ? <span className="yes">✓</span> : v === false ? <span className="no">—</span> : <span className="val">{v}</span>

  return (
    <>
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" onLoad={() => setThreeReady(true)} />
      <style>{CSS}</style>

      <div className="aurora" />
      <canvas ref={bgRef} id="three-canvas" />
      <div className="grain" />

      {/* FEATURE TICKER */}
      <div className="fticker-wrap">
        <div className="fticker">
          {[...FEATURES_TICKER, ...FEATURES_TICKER].map((f, i) => (
            <div className="fticker-item" key={i}>
              <span className="fi">{f[0]}</span>
              <span className="ft">{f[1]}</span>
              <span className={'fv' + (i % 2 ? ' gold' : '')}>{f[2]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="lp-content">
        {/* NAV */}
        <nav>
          <Link href="/" className="logo-link">
            <img src="/logo-h.png" alt="GhazuLog" className="logo-img" />
          </Link>
          <div className="nav-pill">
            <a href="#features">Features</a>
            <a href="#insights">AI Insights</a>
            <a href="#compare">Compare</a>
            <a href="#pricing">Pricing</a>
            <Link href="/about">About</Link>
          </div>
          <div className="nav-right">
            <Link href="/login" className="btn btn-ghost">Sign In</Link>
            <Link href="/signup" className="btn">Start Free →</Link>
          </div>
        </nav>

        {/* HERO */}
        <header className="hero">
          <div className="hero-left">
            <div className="badge"><span className="dot" /> NOW IN BETA · FREE PRO FOR EARLY TRADERS</div>
            <h1>Your trading edge is hidden in your <span className="grad">data.</span></h1>
            <p>Stop guessing why you win or lose. GhazuLog turns every trade into clear, actionable insight — so you trade smarter, not harder.</p>
            <div className="hero-cta">
              <Link href="/signup" className="btn btn-lg">Start Free Today →</Link>
              <a href="#features" className="btn btn-ghost btn-lg">See Features</a>
            </div>
            <div className="hero-trust">
              <span>Free forever plan</span>
              <span>No credit card</span>
              <span>Import MT4/MT5/Binance</span>
            </div>
          </div>
          <div className="hero-right" style={{ flexDirection:'column', justifyContent:'center', gap:'22px' }}>
            <div className="badge" style={{ marginBottom:0 }}>
              <span className="dot" /> EVERY PRO TRACKS THEIR EDGE. NOW YOU CAN TOO.
            </div>
            <div style={{ position:'relative', width:'100%', maxWidth:'none', borderRadius:'14px', overflow:'hidden', border:'1px solid rgba(45,212,191,0.3)', boxShadow:'0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(45,212,191,0.12)' }}>
              <img src="/dashboard-preview.png" alt="GhazuLog dashboard" style={{ width:'100%', display:'block' }} />
            </div>
          </div>
          <canvas ref={candleRef} className="candles" />
        </header>

        {/* MARQUEE */}
        <div className="marquee">
          <div className="marquee-inner">
            <span>Track Every Trade Analyze Performance Backtest Strategies AI Coaching Prop Firm Tracker Free Forever Smart Playbooks Real Market Data Calendar Analytics</span>
            <span>Track Every Trade Analyze Performance Backtest Strategies AI Coaching Prop Firm Tracker Free Forever Smart Playbooks Real Market Data Calendar Analytics</span>
          </div>
        </div>

        {/* AI INSIGHTS */}
        <section id="insights">
          <div className="split">
            <div ref={ins.ref} className={'reveal' + (ins.inView ? ' in' : '')}>
              <div className="kicker">AI Insights</div>
              <h2 style={{ fontSize: '38px', fontWeight: 700, letterSpacing: '-1px', marginBottom: '16px' }}>Your patterns, decoded.</h2>
              <p style={{ color: 'var(--lp-muted)' }}>Automatic analysis spots what you can&apos;t see yourself — the setups that work, the days that hurt, the habits that drain your account.</p>
              <ul className="split-list">
                <li>Find your most profitable setups</li>
                <li>Catch revenge trading &amp; FOMO patterns</li>
                <li>Know your best trading hours &amp; days</li>
                <li>Get a clear 30-day improvement plan</li>
              </ul>
            </div>
            <div className={'split-visual reveal' + (ins.inView ? ' in' : '')}>
              <div className="ex-label">Example insights</div>
              <div className="insight-row"><span>🔴</span><span>Win rate drops to 43% after 2pm — your edge is the morning session.</span></div>
              <div className="insight-row"><span>🟡</span><span>You lose on 80% of Friday trades. Consider sitting Fridays out.</span></div>
              <div className="insight-row"><span>🟢</span><span>Your EMA setup hits 71% over 48 trades. Trade it more.</span></div>
              <div className="insight-row"><span>🔴</span><span>3 revenge trades detected this week — wait 15 min after a loss.</span></div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features">
          <div className="sec-head">
            <div className="kicker">Everything you need</div>
            <h2>Built for the way you trade</h2>
            <p>From your first journal entry to passing a funded challenge — one intelligent platform.</p>
          </div>
          <div className="features">
            <div ref={f1.ref} className={'feature wide reveal' + (f1.inView ? ' in' : '')} data-tilt>
              <div className="i3d i3d-bars-w"><div className="i3d-bars"><i /><i /><i /><i /></div></div>
              <h3>Discover what&apos;s making — and costing — you money</h3>
              <p>Win rate, profit factor, expectancy, max streaks, long vs short edge, P&amp;L by symbol and setup. Plus a full calendar view: drill from year to month to a single day&apos;s trades.</p>
            </div>
            <div ref={f2.ref} className={'feature reveal' + (f2.inView ? ' in' : '')} data-tilt>
              <div className="i3d"><div className="i3d-core" /></div>
              <h3>AI Insights</h3>
              <p>Spot the patterns behind your wins and losses — revenge trading, FOMO, bad timing — before they cost you.</p>
            </div>
            <div ref={f3.ref} className={'feature reveal' + (f3.inView ? ' in' : '')} data-tilt>
              <div className="i3d"><div className="i3d-book"><i /><i /><i /></div></div>
              <h3>Smart Playbooks</h3>
              <p>Build strategies with rules and checklists. See which playbook actually makes money — and double down.</p>
            </div>
            <div ref={f4.ref} className={'feature reveal' + (f4.inView ? ' in' : '')} data-tilt>
              <div className="i3d"><div className="i3d-shield" /></div>
              <h3>Prop Firm Tracker</h3>
              <p>Live drawdown monitoring, safe-risk suggestions, and a pass-probability score so you never blow a challenge.</p>
            </div>
            <div ref={f5.ref} className={'feature reveal' + (f5.inView ? ' in' : '')} data-tilt>
              <div className="i3d"><div className="i3d-bolt" /></div>
              <h3>One-Click Import</h3>
              <p>Bring trades from MT4, MT5, Binance, Bybit and more — auto-detected and instantly analyzed.</p>
            </div>
            <div ref={f6.ref} className={'feature wide reveal' + (f6.inView ? ' in' : '')} data-tilt>
              <div className="i3d"><div className="i3d-cube"><i /><i /><i /><i /><i /><i /></div></div>
              <h3>Backtest before you risk a cent</h3>
              <p>Replay real market candles bar-by-bar on pro charts. Test your strategy across years of history in minutes.</p>
            </div>
          </div>
        </section>

        {/* BIG KINETIC */}
        <div className="big-text">
          <div className="big-text-inner">
            <h3>TRADE SMARTER —</h3><h3>NOT HARDER —</h3><h3>TRADE SMARTER —</h3><h3>NOT HARDER —</h3>
          </div>
        </div>

        {/* COMPARE TABLE */}
        <section id="compare">
          <div className="sec-head">
            <div className="kicker">Compare plans</div>
            <h2>Find the plan that fits</h2>
            <p>Tap a plan to highlight it. Every feature, side by side.</p>
          </div>
          <div className="tier-toggle">
            {(['free', 'pro', 'elite'] as const).map(t => (
              <button key={t} className={'tier-btn' + (tier === t ? ' active' : '')} data-tier={t} onClick={() => setTier(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div ref={cmp.ref} className={'compare-table reveal' + (cmp.inView ? ' in' : '')} data-active={tier}>
            <div className="compare-row compare-head">
              <div>Feature</div><div className="col-free">Free</div><div className="col-pro">Pro</div><div className="col-elite">Elite</div>
            </div>
            <div className="compare-body">
              {COMPARE.map((row, i) => (
                <div className="compare-row" key={tier + i} style={{ animationDelay: `${i * 0.04}s` }}>
                  <div>{row[0]}</div><div>{cell(row[1])}</div><div>{cell(row[2])}</div><div>{cell(row[3])}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing">
          <div className="sec-head">
            <div className="kicker">Simple pricing</div>
            <h2>Start free. Upgrade when ready.</h2>
            <p>No credit card to start. A free-forever plan with everything you need to begin.</p>
          </div>
          <div ref={prc.ref} className={'pricing reveal' + (prc.inView ? ' in' : '')}>
            <div className="plan">
              <div className="pname">Free</div>
              <div className="price">$0<span>/mo</span></div>
              <div className="pdesc">Everything you need to start journaling.</div>
              <ul>
                <li>10 trades per day</li><li>AI Insights</li><li>Performance analytics</li>
                <li>1 CSV import / day</li><li>Backtesting</li><li className="off">Prop firm tracker</li>
              </ul>
              <Link href="/signup" className="btn btn-ghost">Get Started</Link>
            </div>
            <div className="plan featured">
              <div className="pname">Pro</div>
              <div className="price">$9.99<span>/mo</span></div>
              <div className="pdesc">For active traders who want the full edge.</div>
              <ul>
                <li>Unlimited trades</li><li>Gemini Deep AI</li><li>Backtesting</li>
                <li>Smart Playbooks</li><li>CSV export</li><li>10 imports / day</li>
              </ul>
              <Link href="/signup" className="btn">Start Pro Free</Link>
            </div>
            <div className="plan">
              <div className="pname">Elite</div>
              <div className="price">$24<span>/mo</span></div>
              <div className="pdesc">Everything, unlimited. For the pros.</div>
              <ul>
                <li>Unlimited trades</li><li>Everything in Pro</li><li>Prop Firm Tracker</li>
                <li>Pass-probability AI</li><li>API access</li><li>Priority support</li>
              </ul>
              <Link href="/signup" className="btn btn-ghost">Go Elite</Link>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <div ref={cta.ref} className={'final-cta reveal' + (cta.inView ? ' in' : '')}>
          <h2>Your edge is hiding in your data.</h2>
          <p>Join the beta and get Pro free. Start finding it today.</p>
          <Link href="/signup" className="btn btn-lg">Create Your Free Account →</Link>
          <div style={{ marginTop: '18px', fontSize: '13px', color: 'var(--lp-muted)' }}>Free forever plan · Takes 30 seconds</div>
        </div>

        <footer className="lp-footer">
          <img src="/logo-icon.png" alt="GhazuLog" style={{ height: '24px', objectFit: 'contain', marginBottom: '10px' }} />
          <div>© 2026 GhazuLog · Trade smarter, not harder.</div>
        </footer>
      </div>
    </>
  )
}

const CSS = `
:root {
  --lp-bg: #04070d; --lp-teal: #00e6b8; --lp-teal-bright: #2dffd4; --lp-teal-dim: #00d4aa;
  --lp-gold: #e3b341; --lp-gold-bright: #ffd564; --lp-red: #ff5d57; --lp-text: #eaf2ff;
  --lp-muted: #7d8fa8; --lp-line: rgba(0,230,184,0.12); --lp-glass: rgba(10,16,28,0.5);
}
body { background: var(--lp-bg); margin: 0; }
.aurora { position: fixed; top: 0; left: 0; right: 0; height: 70vh; z-index: 0; pointer-events: none;
  background: radial-gradient(ellipse 60% 50% at 50% -10%, rgba(0,230,184,0.25), transparent 70%), radial-gradient(ellipse 40% 40% at 30% -5%, rgba(0,230,184,0.15), transparent 60%), radial-gradient(ellipse 50% 45% at 70% 0%, rgba(227,179,65,0.12), transparent 65%);
  animation: lp-aurora 12s ease-in-out infinite alternate; }
@keyframes lp-aurora { 0%{transform:translateX(-3%) scaleY(1);opacity:.8;} 100%{transform:translateX(3%) scaleY(1.1);opacity:1;} }
#three-canvas { position: fixed; top:0; left:0; width:100%; height:100%; z-index:1; pointer-events:none; }
.grain { position: fixed; inset: 0; z-index: 2; opacity: 0.035; pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
.lp-content { position: relative; z-index: 3; font-family: 'Sora', -apple-system, BlinkMacSystemFont, sans-serif; color: var(--lp-text); line-height: 1.6; }

.fticker-wrap { position: fixed; top: 0; left: 0; right: 0; z-index: 95; background: rgba(4,7,13,0.9); backdrop-filter: blur(12px); border-bottom: 1px solid var(--lp-line); overflow: hidden; height: 40px; display: flex; align-items: center; }
.fticker { display: flex; white-space: nowrap; animation: lp-scroll 35s linear infinite; }
.fticker:hover { animation-play-state: paused; }
.fticker-item { display: flex; align-items: center; gap: 9px; font-size: 12.5px; padding: 0 26px; border-right: 1px solid rgba(255,255,255,0.06); }
.fticker-item .fi { font-size: 14px; }
.fticker-item .ft { color: var(--lp-text); font-weight: 600; }
.fticker-item .fv { color: var(--lp-teal); font-family: 'JetBrains Mono', monospace; font-size: 11px; }
.fticker-item .fv.gold { color: var(--lp-gold); }
@keyframes lp-scroll { from{transform:translateX(0);} to{transform:translateX(-50%);} }

nav { position: fixed; top: 40px; left: 0; right: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 14px 48px; }
.logo-link { display: flex; align-items: center; }
.logo-img { height: 36px; object-fit: contain; }
.nav-pill { display: flex; gap: 6px; align-items: center; background: var(--lp-glass); backdrop-filter: blur(12px); border: 1px solid var(--lp-line); border-radius: 100px; padding: 6px; }
.nav-pill a { color: var(--lp-muted); text-decoration: none; font-size: 13px; padding: 7px 16px; border-radius: 100px; transition: all .2s; }
.nav-pill a:hover { color: var(--lp-text); background: rgba(255,255,255,0.05); }
.nav-right { display: flex; gap: 12px; align-items: center; }
.btn { background: var(--lp-teal); color: #03110d; padding: 10px 22px; border-radius: 100px; font-weight: 700; font-size: 14px; text-decoration: none; border: none; cursor: pointer; transition: transform .2s, box-shadow .2s; display:inline-flex; align-items:center; gap:8px; }
.btn:hover { transform: translateY(-2px); box-shadow: 0 8px 30px -8px rgba(0,230,184,0.6); }
.btn-ghost { background: rgba(255,255,255,0.03); color: var(--lp-text); border: 1px solid var(--lp-line); }
.btn-ghost:hover { box-shadow: none; background: rgba(255,255,255,0.08); }

.hero { min-height: 100vh; display: grid; grid-template-columns: 1fr 1.35fr; align-items: center; padding: 150px 48px 60px; gap: 40px; position: relative; max-width: 1300px; margin: 0 auto; }
.hero-left { z-index: 5; }
.badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(0,230,184,0.08); border: 1px solid var(--lp-line); padding: 7px 16px; border-radius: 100px; font-size: 12px; color: var(--lp-teal); margin-bottom: 28px; font-family: 'JetBrains Mono', monospace; animation: lp-up .8s ease both; }
.badge .dot { width: 7px; height: 7px; background: var(--lp-teal); border-radius: 50%; box-shadow: 0 0 10px var(--lp-teal); animation: lp-pulse 2s infinite; }
@keyframes lp-pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
.hero h1 { font-size: clamp(40px, 5.5vw, 72px); font-weight: 800; line-height: 1.05; letter-spacing: -2px; margin-bottom: 24px; animation: lp-up .8s ease .1s both; }
.hero h1 .grad { background: linear-gradient(120deg, var(--lp-teal) 0%, var(--lp-gold) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.hero-left p { font-size: clamp(16px, 1.6vw, 19px); color: var(--lp-muted); max-width: 480px; margin-bottom: 36px; animation: lp-up .8s ease .2s both; }
.hero-cta { display: flex; gap: 14px; flex-wrap: wrap; animation: lp-up .8s ease .3s both; }
.btn-lg { padding: 15px 30px; font-size: 16px; }
.hero-trust { display: flex; gap: 20px; margin-top: 32px; flex-wrap: wrap; animation: lp-up .8s ease .4s both; }
.hero-trust span { font-size: 13px; color: var(--lp-muted); display: flex; align-items: center; gap: 6px; }
.hero-trust span::before { content: '✓'; color: var(--lp-teal); font-weight: 700; }
@keyframes lp-up { from{opacity:0; transform:translateY(30px);} to{opacity:1; transform:translateY(0);} }

.hero-right { position: relative; height: 600px; display: flex; align-items: center; justify-content: flex-end; overflow: visible; }
.kinetic { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; overflow: hidden; z-index: 1; opacity: 0.5; -webkit-mask-image: radial-gradient(circle at center, black 30%, transparent 75%); mask-image: radial-gradient(circle at center, black 30%, transparent 75%); }
.kinetic-row { font-size: 56px; font-weight: 800; letter-spacing: -1px; white-space: nowrap; color: var(--lp-teal); line-height: 1.25; opacity: 0.85; }
.kinetic-row:nth-child(even) { color: var(--lp-gold); opacity: 0.5; }
#spiral-canvas { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; }
.spiral-fallback { position: absolute; top: 50%; left: 50%; width: 280px; height: 280px; transform: translate(-50%,-50%); z-index: 1; border-radius: 50%; background: radial-gradient(circle at 40% 35%, rgba(0,230,184,0.5), rgba(0,230,184,0.15) 40%, transparent 70%), radial-gradient(circle at 65% 70%, rgba(227,179,65,0.35), transparent 60%); filter: blur(8px); animation: lp-orb 6s ease-in-out infinite; }
@keyframes lp-orb { 0%,100%{ transform: translate(-50%,-50%) scale(1); opacity:0.8; } 50%{ transform: translate(-50%,-50%) scale(1.12); opacity:1; } }
.candles { position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 100vw; height: 180px; z-index: 0; opacity: 0.5; pointer-events: none; }

section { padding: 100px 48px; max-width: 1200px; margin: 0 auto; position: relative; }
.sec-head { text-align: center; margin-bottom: 60px; }
.kicker { font-family: 'JetBrains Mono', monospace; color: var(--lp-teal); font-size: 12px; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 16px; }
.sec-head h2 { font-size: clamp(30px, 4vw, 48px); font-weight: 700; letter-spacing: -1px; margin: 0; }
.sec-head p { color: var(--lp-muted); margin-top: 14px; max-width: 540px; margin-left: auto; margin-right: auto; }

.marquee { overflow: hidden; border-top: 1px solid var(--lp-line); border-bottom: 1px solid var(--lp-line); padding: 18px 0; background: rgba(0,230,184,0.02); }
.marquee-inner { display: flex; gap: 32px; white-space: nowrap; animation: lp-scroll 30s linear infinite; }
.marquee-inner span { font-size: 15px; font-weight: 600; color: var(--lp-muted); display: flex; align-items: center; gap: 32px; }
.marquee-inner span::after { content: '◆'; color: var(--lp-teal); font-size: 9px; }

.features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.feature { background: var(--lp-glass); border: 1px solid var(--lp-line); border-radius: 20px; padding: 30px; backdrop-filter: blur(8px); transition: transform .3s, border-color .3s; position: relative; overflow: hidden; }
.feature::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--lp-teal), transparent); opacity: 0; transition: opacity .3s; }
.feature:hover { transform: translateY(-6px); border-color: rgba(0,230,184,0.4); }
.feature:hover::before { opacity: 1; }
.feature h3 { font-size: 18px; font-weight: 600; margin-bottom: 9px; margin-top: 0; }
.feature p { color: var(--lp-muted); font-size: 14px; margin: 0; }
.feature.wide { grid-column: span 2; }

.i3d { width: 60px; height: 60px; margin-bottom: 16px; perspective: 300px; display: flex; align-items: center; justify-content: center; }
.i3d > div { transform-style: preserve-3d; }
.i3d-bars { display: flex; gap: 5px; align-items: flex-end; height: 44px; animation: lp-spinY 6s linear infinite; }
.i3d-bars i { width: 8px; border-radius: 2px; box-shadow: 0 0 10px rgba(0,230,184,0.5); }
.i3d-bars i:nth-child(1){ height: 20px; background: var(--lp-teal); }
.i3d-bars i:nth-child(2){ height: 38px; background: var(--lp-gold); }
.i3d-bars i:nth-child(3){ height: 28px; background: var(--lp-teal); }
.i3d-bars i:nth-child(4){ height: 46px; background: var(--lp-gold); }
.i3d-core { width: 40px; height: 40px; background: linear-gradient(135deg, var(--lp-teal), var(--lp-teal-dim)); border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; box-shadow: 0 0 20px rgba(0,230,184,0.6), inset -4px -4px 10px rgba(0,0,0,0.3); animation: lp-morph 4s ease-in-out infinite, lp-spinY 8s linear infinite; }
@keyframes lp-morph { 0%,100%{border-radius:30% 70% 70% 30% / 30% 30% 70% 70%;} 50%{border-radius:70% 30% 40% 60% / 60% 40% 60% 40%;} }
.i3d-book i { display: block; height: 7px; border-radius: 2px; margin: 3px 0; }
.i3d-book { animation: lp-spinY 7s linear infinite; }
.i3d-book i:nth-child(1){ width: 44px; background: var(--lp-teal); box-shadow: 0 0 8px rgba(0,230,184,0.4); }
.i3d-book i:nth-child(2){ width: 38px; background: var(--lp-gold); }
.i3d-book i:nth-child(3){ width: 42px; background: var(--lp-teal); }
.i3d-shield { width: 40px; height: 46px; background: linear-gradient(160deg, var(--lp-teal), var(--lp-teal-dim)); clip-path: polygon(50% 0, 100% 22%, 100% 65%, 50% 100%, 0 65%, 0 22%); box-shadow: 0 0 18px rgba(0,230,184,0.5); animation: lp-flip 5s ease-in-out infinite; }
@keyframes lp-flip { 0%,100%{transform:rotateY(0);} 50%{transform:rotateY(180deg);} }
.i3d-bolt { width: 44px; height: 44px; background: linear-gradient(135deg, var(--lp-gold), var(--lp-gold-bright)); transform: rotate(45deg); border-radius: 8px; box-shadow: 0 0 20px rgba(227,179,65,0.6); animation: lp-spin3d 5s linear infinite; }
@keyframes lp-spin3d { from{transform:rotate(45deg) rotateY(0);} to{transform:rotate(45deg) rotateY(360deg);} }
.i3d-cube { position: relative; width: 40px; height: 40px; transform-style: preserve-3d; animation: lp-cube 8s linear infinite; }
.i3d-cube i { position: absolute; width: 40px; height: 40px; background: rgba(0,230,184,0.15); border: 1px solid var(--lp-teal); box-shadow: inset 0 0 12px rgba(0,230,184,0.3); }
.i3d-cube i:nth-child(1){ transform: translateZ(20px); }
.i3d-cube i:nth-child(2){ transform: rotateY(180deg) translateZ(20px); }
.i3d-cube i:nth-child(3){ transform: rotateY(90deg) translateZ(20px); border-color: var(--lp-gold); background: rgba(227,179,65,0.12); }
.i3d-cube i:nth-child(4){ transform: rotateY(-90deg) translateZ(20px); border-color: var(--lp-gold); background: rgba(227,179,65,0.12); }
.i3d-cube i:nth-child(5){ transform: rotateX(90deg) translateZ(20px); }
.i3d-cube i:nth-child(6){ transform: rotateX(-90deg) translateZ(20px); }
@keyframes lp-cube { from{transform:rotateX(-20deg) rotateY(0);} to{transform:rotateX(-20deg) rotateY(360deg);} }
@keyframes lp-spinY { from{transform:rotateY(0);} to{transform:rotateY(360deg);} }
.feature:hover .i3d-bars, .feature:hover .i3d-core, .feature:hover .i3d-book, .feature:hover .i3d-shield, .feature:hover .i3d-bolt, .feature:hover .i3d-cube { animation-duration: 2s; }

.big-text { overflow: hidden; padding: 60px 0; position: relative; }
.big-text-inner { display: flex; white-space: nowrap; animation: lp-scroll 25s linear infinite; }
.big-text-inner h3 { font-size: clamp(60px, 12vw, 140px); font-weight: 800; letter-spacing: -3px; padding: 0 40px; margin: 0; background: linear-gradient(90deg, var(--lp-teal), var(--lp-gold), var(--lp-teal)); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; animation: lp-sheen 4s linear infinite; }
@keyframes lp-sheen { to { background-position: 200% center; } }

.split { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: center; }
.split-visual { background: var(--lp-glass); border: 1px solid var(--lp-line); border-radius: 24px; padding: 24px; backdrop-filter: blur(8px); position: relative; }
.ex-label { position: absolute; top: 12px; right: 14px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: var(--lp-muted); font-family: 'JetBrains Mono', monospace; }
.insight-row { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: rgba(255,255,255,0.02); margin-bottom: 10px; font-size: 13px; }
.split-list { list-style: none; margin-top: 20px; padding: 0; }
.split-list li { padding: 11px 0; font-size: 15px; display: flex; gap: 10px; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
.split-list li::before { content: '✓'; color: var(--lp-teal); font-weight: 700; }

.tier-toggle { display: flex; gap: 4px; justify-content: center; margin-bottom: 32px; background: var(--lp-glass); border: 1px solid var(--lp-line); border-radius: 100px; padding: 5px; width: fit-content; margin-left: auto; margin-right: auto; }
.tier-btn { background: transparent; border: none; color: var(--lp-muted); padding: 9px 28px; border-radius: 100px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .3s; font-family: 'Sora', sans-serif; }
.tier-btn.active[data-tier="free"] { background: #8497a8; color: #03110d; }
.tier-btn.active[data-tier="pro"] { background: var(--lp-teal); color: #03110d; }
.tier-btn.active[data-tier="elite"] { background: var(--lp-gold); color: #1a1405; }
.compare-table { background: var(--lp-glass); border: 1px solid var(--lp-line); border-radius: 20px; overflow: hidden; backdrop-filter: blur(8px); }
.compare-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; align-items: center; padding: 14px 24px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.compare-row > div { text-align: center; font-size: 14px; }
.compare-row > div:first-child { text-align: left; color: var(--lp-text); font-weight: 500; }
.compare-head { background: #0d1420; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
.compare-head .col-free { color: var(--lp-muted); }
.compare-head .col-pro { color: var(--lp-teal); }
.compare-head .col-elite { color: var(--lp-gold); }
.compare-row .yes { color: var(--lp-teal); font-weight: 700; }
.compare-row .no { color: var(--lp-muted); opacity: 0.4; }
.compare-row .val { color: var(--lp-text); font-family: 'JetBrains Mono', monospace; font-size: 13px; }
.compare-table[data-active="free"] .compare-row > div:nth-child(2),
.compare-table[data-active="pro"] .compare-row > div:nth-child(3) { background: rgba(0,230,184,0.06); }
.compare-table[data-active="elite"] .compare-row > div:nth-child(4) { background: rgba(227,179,65,0.07); }
.compare-body .compare-row { animation: lp-rowin .5s ease both; }
@keyframes lp-rowin { from{opacity:0;transform:translateX(-15px);} to{opacity:1;transform:translateX(0);} }

.pricing { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; align-items: stretch; }
.plan { background: var(--lp-glass); border: 1px solid var(--lp-line); border-radius: 24px; padding: 34px 30px; backdrop-filter: blur(8px); display: flex; flex-direction: column; transition: transform .3s; }
.plan:hover { transform: translateY(-6px); }
.plan.featured { border-color: var(--lp-teal); background: linear-gradient(180deg, rgba(0,230,184,0.07), var(--lp-glass)); position: relative; }
.plan.featured::after { content: 'MOST POPULAR'; position: absolute; top: -11px; left: 50%; transform: translateX(-50%); background: var(--lp-teal); color: #03110d; font-size: 10px; font-weight: 700; letter-spacing: 1px; padding: 5px 14px; border-radius: 100px; font-family: 'JetBrains Mono', monospace; }
.plan .pname { font-size: 14px; color: var(--lp-muted); text-transform: uppercase; letter-spacing: 1px; font-family: 'JetBrains Mono', monospace; }
.plan .price { font-size: 46px; font-weight: 800; margin: 14px 0 4px; }
.plan .price span { font-size: 15px; color: var(--lp-muted); font-weight: 400; }
.plan .pdesc { color: var(--lp-muted); font-size: 13px; margin-bottom: 22px; min-height: 38px; }
.plan ul { list-style: none; margin-bottom: 26px; flex: 1; padding: 0; }
.plan li { padding: 8px 0; font-size: 13px; display: flex; align-items: center; gap: 9px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.plan li::before { content: '✓'; color: var(--lp-teal); font-weight: 700; }
.plan li.off { color: var(--lp-muted); opacity: .5; }
.plan li.off::before { content: '—'; color: var(--lp-muted); }

.final-cta { text-align: center; background: linear-gradient(135deg, rgba(0,230,184,0.08), rgba(227,179,65,0.05)); border: 1px solid var(--lp-line); border-radius: 32px; padding: 80px 40px; margin: 60px auto; max-width: 900px; position: relative; overflow: hidden; }
.final-cta h2 { font-size: clamp(32px, 5vw, 54px); font-weight: 800; letter-spacing: -1.5px; margin-bottom: 18px; margin-top: 0; }
.final-cta p { color: var(--lp-muted); margin-bottom: 34px; font-size: 17px; }
.lp-footer { text-align: center; padding: 48px; color: var(--lp-muted); font-size: 13px; border-top: 1px solid var(--lp-line); }

.reveal { opacity: 0; transform: translateY(40px); transition: opacity .8s, transform .8s; }
.reveal.in { opacity: 1; transform: translateY(0); }

@media (max-width: 900px) {
  nav { padding: 12px 18px; top: 40px; }
  .nav-pill { display: none; }
  .nav-right .btn-ghost { display: none; }
  .logo-img { height: 30px; }
  .hero { grid-template-columns: 1fr; padding: 130px 20px 40px; text-align: center; }
  .hero-left { display: flex; flex-direction: column; align-items: center; }
  .hero-cta, .hero-trust { justify-content: center; }
  .hero-right { height: 300px; order: -1; }
  section { padding: 56px 20px; }
  .features, .pricing, .split { grid-template-columns: 1fr; }
  .feature.wide { grid-column: span 1; }
  .kinetic-row { font-size: 32px; }
  .compare-row { grid-template-columns: 1.4fr 0.9fr 0.9fr 0.9fr; padding: 11px 12px; }
  .compare-row > div { font-size: 11px; }
  .compare-row > div:first-child { font-size: 12px; }
  .tier-btn { padding: 8px 16px; font-size: 13px; }
  .fticker-item { padding: 0 16px; font-size: 11.5px; }
  .big-text-inner h3 { font-size: 56px; }
  .final-cta { padding: 56px 24px; }
}
@media (max-width: 500px) {
  .hero h1 { font-size: 36px; letter-spacing: -1px; }
  .hero-trust { flex-direction: column; gap: 8px; }
  .btn-lg { padding: 13px 24px; font-size: 15px; }
  .compare-row > div { font-size: 10px; }
  .plan .price { font-size: 40px; }
}
`
