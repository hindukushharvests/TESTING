# GhazuLog — Trading Journal SaaS Boilerplate

A complete, production-ready trading journal and analytics platform built with **Next.js** and **Supabase**. Log trades, analyze performance across 50+ reports, backtest strategies on real chart data, track prop-firm challenges, and generate AI-powered insights.

**Live demo:** https://ghazulog.com

---

## Features

- **Authentication** — signup, login, email confirmation, password reset (Supabase Auth)
- **Dashboard** — net P&L, win rate, profit factor, avg R:R, equity curve, best/worst trade
- **Trade Journal** — full CRUD, CSV import with broker auto-detection, setup/mistake tagging
- **Reports** — 50+ analytics views: P&L by day/symbol/hour, long vs short, expectancy, streaks, win rate by setup, calendar drill-down
- **Backtesting** — TradingView charts with bar-by-bar manual trade logging and per-session stats
- **Playbooks** — strategy builder with rules and checklists
- **AI Insights** — trader score, best/worst days, top mistakes, revenge-trade detection, auto-generated trading rules
- **Prop Firm Tracker** — model challenges (targets, daily loss, drawdown, phases) with progress tracking
- **Economic Calendar** — market events
- **Landing page** — animated marketing page with pricing and feature comparison

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database & Auth | Supabase (PostgreSQL) |
| Styling | TailwindCSS + Shadcn/UI |
| Trading charts | TradingView Lightweight Charts |
| Analytics charts | Recharts |
| AI | Google Gemini API |
| Market data | Financial Modeling Prep API |
| CSV parsing | PapaParse |
| Hosting | Vercel |

---

## Requirements

- **Node.js** (LTS version, 18+)
- A free **Supabase** account — https://supabase.com
- A free **Google Gemini** API key — https://aistudio.google.com/app/apikey
- A free **Financial Modeling Prep** API key — https://site.financialmodelingprep.com/developer/docs
- Basic knowledge of Next.js to customize

---

## Setup (about 15 minutes)

### 1. Install dependencies

\`\`\`bash
npm install
\`\`\`

### 2. Set up your environment variables

Copy the example file and fill in your own keys:

\`\`\`bash
cp .env.example .env.local
\`\`\`

Then open \`.env.local\` and add your values:

\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
FMP_API_KEY=your_fmp_api_key
\`\`\`

**Where to get each key:**
- **Supabase** (URL, anon key, service role key): create a project at supabase.com -> Project Settings -> API
- **Gemini**: aistudio.google.com/app/apikey (free)
- **FMP**: financialmodelingprep.com (free tier available)

> The service role key is server-only — it has full admin access. Never expose it in client-side code.

### 3. Set up the database

In your Supabase project, open the **SQL Editor** and create the required tables (schema below). Then enable **Row Level Security (RLS)** on each table with policies so each user can only read/write their own rows.

### 4. Run the development server

\`\`\`bash
npm run dev
\`\`\`

Open http://localhost:3000 — you're live locally.

---

## Database Schema (Supabase / PostgreSQL)

Create these tables in the Supabase SQL editor:

\`\`\`
trades (
  id, user_id, symbol, trade_date, direction, market,
  entry_price, exit_price, quantity, gross_pnl, fees, net_pnl,
  setup_tags[], mistake_tags[], notes, status, playbook_id
)

backtest_sessions (
  id, user_id, symbol, timeframe, name, notes,
  starting_capital, total_trades, win_rate, total_pnl
)

prop_accounts (
  id, user_id, firm_name, account_size,
  max_daily_loss, max_total_drawdown, profit_target,
  current_balance, status
)

profiles (
  id, username, full_name, avatar_url,
  subscription_tier DEFAULT 'free'
)
\`\`\`

> Each table should have RLS enabled with a policy like \`auth.uid() = user_id\` so users only access their own data.

---

## Deployment (Vercel)

1. Push the code to your own GitHub repository.
2. Import the repo into [Vercel](https://vercel.com).
3. Add your five environment variables in the Vercel project settings (Settings -> Environment Variables).
4. Deploy. Vercel handles SSL and CI/CD automatically.
5. (Optional) Connect a custom domain.

---

## Project Structure

\`\`\`
src/
  app/
    (auth)/           # login, signup, confirmed, forgot-password, reset-password
    (dashboard)/      # dashboard, journal, reports, backtest, prop-firms, ai-insights, import, playbooks
    about/
    api/              # admin, chart, economic-calendar, gemini, trades
    landing/          # marketing landing page
public/               # logos, static assets
\`\`\`

---

## Pricing Tiers (built into the product)

The app includes a three-tier structure in the database (\`subscription_tier\`):

| Tier | Suggested Price |
|---|---|
| Free | \$0 |
| Pro | \$9.99/mo |
| Elite | \$24/mo |

> Payment checkout (Stripe / Lemon Squeezy) is **not** connected — you add your preferred payment provider.

---

## Notes

- **Gemini "Deep Analysis"** is scaffolded (the UI shows a "Soon" badge). The rule-based AI Insights work out of the box; the deeper LLM layer is left for you to wire up with your Gemini key.
- The code uses environment variables throughout — no keys are hardcoded.

---

## License

Single end-product license: you may use this codebase to build and launch **your own** trading journal product. Reselling or redistributing the source code itself is not permitted.

---

## Support

Built solo. For reasonable setup questions, reach out via your purchase receipt.