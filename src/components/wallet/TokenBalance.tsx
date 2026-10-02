import { ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown } from 'lucide-react'

interface TokenBalanceProps {
  symbol: string
  name: string
  balance: string
  usdValue: number
  change24h: number
  chain: string
  logo: string
}

export default function TokenBalance({ symbol, name, balance, usdValue, change24h, chain, logo }: TokenBalanceProps) {
  const isPositive = change24h >= 0

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-gami-surface border border-gami-border hover:border-gami-purple transition-colors group">
      {/* Logo */}
      <div className="w-10 h-10 bg-gami-bg border border-gami-border flex items-center justify-center text-xl flex-shrink-0">
        {logo}
      </div>

      {/* Name + chain */}
      <div className="flex-1 min-w-0">
        <div className="font-display font-semibold text-white text-sm">{symbol}</div>
        <div className="font-mono text-xs text-gami-muted">{name} · {chain}</div>
      </div>

      {/* Balance */}
      <div className="text-right">
        <div className="font-mono text-white text-sm">{balance}</div>
        <div className="font-mono text-xs text-gami-muted">${usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>

      {/* 24h change */}
      <div className={`flex items-center gap-1 font-mono text-xs w-16 justify-end ${isPositive ? 'text-gami-green' : 'text-gami-red'}`}>
        {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {isPositive ? '+' : ''}{change24h.toFixed(1)}%
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="p-1.5 bg-gami-bg border border-gami-border hover:border-gami-green hover:text-gami-green transition-colors text-gami-muted">
          <ArrowUpRight size={12} />
        </button>
        <button className="p-1.5 bg-gami-bg border border-gami-border hover:border-gami-purple hover:text-gami-accent transition-colors text-gami-muted">
          <ArrowDownLeft size={12} />
        </button>
      </div>
    </div>
  )
}
