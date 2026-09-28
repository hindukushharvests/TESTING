export type Market = 'stocks' | 'forex' | 'crypto'
export type Direction = 'long' | 'short'
export type TradeStatus = 'open' | 'closed'

export interface Trade {
  id: string
  user_id: string
  symbol: string
  trade_date: string
  trade_time?: string
  direction: Direction
  market: Market
  entry_price: number
  exit_price?: number
  quantity: number
  gross_pnl?: number
  fees: number
  net_pnl?: number
  setup_tags: string[]
  mistake_tags: string[]
  notes?: string
  screenshot_url?: string
  playbook_id?: string
  status: TradeStatus
  created_at: string
}

export interface Playbook {
  id: string
  user_id: string
  name: string
  description?: string
  rules: string[]
  market: string
  is_active: boolean
  created_at: string
}

export interface PropAccount {
  id: string
  user_id: string
  firm_name: string
  account_size: number
  max_daily_loss: number
  max_total_drawdown: number
  profit_target: number
  current_balance: number
  status: 'active' | 'passed' | 'failed' | 'funded'
  notes?: string
  created_at: string
}

export interface Profile {
  id: string
  username?: string
  full_name?: string
  avatar_url?: string
  default_market: Market
  created_at: string
}

export interface DashboardStats {
  totalNetPnl: number
  winRate: number
  profitFactor: number
  avgRR: number
  totalTrades: number
  maxDrawdown: number
  bestTrade: number
  worstTrade: number
  avgWin: number
  avgLoss: number
}