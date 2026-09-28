'use client'
import { useSubscription } from '@/hooks/useSubscription'
import UpgradeWall from '@/components/UpgradeWall'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BacktestRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/backtest/sessions') }, [])
  return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', color:'#8b949e' }}>Loading...</div>
}
