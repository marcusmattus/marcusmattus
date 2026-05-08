import { useState } from 'react'
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Zap, TrendingUp, TrendingDown, Copy, Check } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'

type WalletTab = 'tokens' | 'nfts' | 'history' | 'bridge'

const tokens = [
  {
    symbol: 'GAMI', name: 'Gami Protocol', balance: 1247.5, value: 3742.5,
    change: 12.4, changeAmt: 412.3, icon: '⚡', color: '#6E3CFB',
  },
  {
    symbol: 'ETH', name: 'Ethereum', balance: 0.842, value: 2947.0,
    change: -2.1, changeAmt: -63.2, icon: '💎', color: '#9C6CFF',
  },
  {
    symbol: 'SOL', name: 'Solana', balance: 12.3, value: 1230.0,
    change: 5.7, changeAmt: 66.3, icon: '🌊', color: '#00F5A0',
  },
  {
    symbol: 'MATIC', name: 'Polygon', balance: 450.0, value: 315.0,
    change: 1.2, changeAmt: 3.7, icon: '🔷', color: '#F5C518',
  },
  {
    symbol: 'USDC', name: 'USD Coin', balance: 500.0, value: 500.0,
    change: 0.0, changeAmt: 0, icon: '💵', color: '#6B7280',
  },
]

const nfts = [
  { name: 'Cyber Blade #001', collection: 'Gami Genesis', rarity: 'Legendary', value: '2.4 ETH', emoji: '⚔️', glow: true },
  { name: 'XP Shrine', collection: 'Quest Artifacts', rarity: 'Epic', value: '0.8 ETH', emoji: '🏛️', glow: true },
  { name: 'Polygon Pioneer', collection: 'Chain Badges', rarity: 'Rare', value: '0.3 ETH', emoji: '🔷', glow: false },
  { name: 'Discord Champion', collection: 'Social Badges', rarity: 'Rare', value: '0.2 ETH', emoji: '🏆', glow: false },
  { name: 'Early Adopter', collection: 'Gami Genesis', rarity: 'Epic', value: '1.1 ETH', emoji: '🌟', glow: true },
  { name: 'DeFi Degen', collection: 'Quest Artifacts', rarity: 'Common', value: '0.05 ETH', emoji: '🔥', glow: false },
]

const history = [
  { type: 'Received', asset: 'GAMI', amount: '+500 GAMI', value: '$1,500', from: '0x1a2b...3c4d', hash: '0xabc...123', time: '2m ago', status: 'Confirmed' },
  { type: 'Sent', asset: 'ETH', amount: '-0.1 ETH', value: '$350', to: '0x5e6f...7g8h', hash: '0xdef...456', time: '1h ago', status: 'Confirmed' },
  { type: 'Quest Reward', asset: 'GAMI', amount: '+200 GAMI', value: '$600', from: 'Protocol', hash: '0xghi...789', time: '3h ago', status: 'Confirmed' },
  { type: 'NFT Purchase', asset: 'ETH', amount: '-0.3 ETH', value: '$1,050', to: 'OpenSea', hash: '0xjkl...012', time: '1d ago', status: 'Confirmed' },
  { type: 'Bridge', asset: 'MATIC', amount: '-100 MATIC', value: '$70', from: 'Ethereum→Polygon', hash: '0xmno...345', time: '2d ago', status: 'Confirmed' },
  { type: 'Staking Reward', asset: 'GAMI', amount: '+47.5 GAMI', value: '$142', from: 'Staking Pool', hash: '0xpqr...678', time: '3d ago', status: 'Confirmed' },
]

const chains = ['Ethereum', 'Polygon', 'Arbitrum', 'Solana', 'Base', 'Optimism']

const rarityGlow: Record<string, string> = {
  Legendary: 'border-gami-yellow shadow-[0_0_20px_rgba(245,197,24,0.4)]',
  Epic: 'border-gami-accent shadow-[0_0_20px_rgba(156,108,255,0.4)]',
  Rare: 'border-gami-purple',
  Common: 'border-gami-border',
}

const rarityText: Record<string, string> = {
  Legendary: 'text-gami-yellow',
  Epic: 'text-gami-accent',
  Rare: 'text-gami-purple',
  Common: 'text-gami-muted',
}

export default function GamifiedWallet() {
  const [tab, setTab] = useState<WalletTab>('tokens')
  const [fromChain, setFromChain] = useState('Ethereum')
  const [toChain, setToChain] = useState('Polygon')
  const [copied, setCopied] = useState(false)
  const wallet = '0x742d35Cc6634C0532925a3b8D4C9E3F2A1B4d8e'

  const handleCopy = () => {
    navigator.clipboard.writeText(wallet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const totalValue = tokens.reduce((s, t) => s + t.value, 0)

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-16 max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl text-white mb-1">Gamified Wallet</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gami-muted">{wallet.slice(0, 8)}...{wallet.slice(-6)}</span>
              <button onClick={handleCopy} className="text-gami-muted hover:text-white transition-colors">
                {copied ? <Check size={12} className="text-gami-green" /> : <Copy size={12} />}
              </button>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-mono text-gami-muted">Total Portfolio</div>
            <div className="font-mono font-bold text-white text-3xl mt-1">
              ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1 justify-end mt-1">
              <TrendingUp size={12} className="text-gami-green" />
              <span className="text-xs font-mono text-gami-green">+8.3% this week</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 mb-8">
          {[
            { icon: <ArrowUpRight size={16} />, label: 'Send', color: 'border-gami-border' },
            { icon: <ArrowDownLeft size={16} />, label: 'Receive', color: 'border-gami-border' },
            { icon: <ArrowLeftRight size={16} />, label: 'Swap', color: 'border-gami-border' },
            { icon: <Zap size={16} />, label: 'Bridge', color: 'border-gami-purple' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => a.label === 'Bridge' ? setTab('bridge') : undefined}
              className={`flex items-center gap-2 bg-gami-surface border px-5 py-3 text-sm font-display font-semibold text-white shadow-brutal hover:shadow-brutal-purple hover:-translate-y-0.5 transition-all ${a.color}`}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex bg-gami-surface border border-gami-border mb-6 shadow-brutal-sm">
          {(['tokens', 'nfts', 'history', 'bridge'] as WalletTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-display font-semibold capitalize transition-colors ${
                tab === t ? 'bg-gami-purple text-white' : 'text-gami-muted hover:text-white'
              }`}
            >
              {t === 'nfts' ? 'NFTs' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* TOKENS TAB */}
        {tab === 'tokens' && (
          <div className="bg-gami-surface border border-gami-border shadow-brutal">
            <div className="grid grid-cols-5 px-6 py-3 border-b border-gami-border text-xs font-mono text-gami-muted uppercase tracking-widest">
              <span className="col-span-2">Asset</span>
              <span className="text-right">Balance</span>
              <span className="text-right">Value</span>
              <span className="text-right">24h Change</span>
            </div>
            {tokens.map((token) => (
              <div
                key={token.symbol}
                className="grid grid-cols-5 px-6 py-4 border-b border-gami-border hover:bg-gami-bg transition-colors items-center"
              >
                <div className="col-span-2 flex items-center gap-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center text-xl border border-gami-border"
                    style={{ background: `${token.color}20` }}
                  >
                    {token.icon}
                  </div>
                  <div>
                    <div className="font-display font-semibold text-white text-sm">{token.symbol}</div>
                    <div className="text-xs font-body text-gami-muted">{token.name}</div>
                  </div>
                </div>
                <div className="text-right font-mono text-white text-sm">{token.balance.toLocaleString()}</div>
                <div className="text-right font-mono text-white text-sm">${token.value.toLocaleString()}</div>
                <div className={`text-right font-mono text-sm flex items-center justify-end gap-1 ${
                  token.change >= 0 ? 'text-gami-green' : 'text-gami-red'
                }`}>
                  {token.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {token.change >= 0 ? '+' : ''}{token.change}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NFTS TAB */}
        {tab === 'nfts' && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {nfts.map((nft) => (
              <div
                key={nft.name}
                className={`bg-gami-surface border p-5 shadow-brutal hover:-translate-y-1 transition-all cursor-pointer ${
                  nft.glow ? rarityGlow[nft.rarity] : 'border-gami-border hover:shadow-brutal-purple'
                }`}
              >
                <div
                  className="aspect-square flex items-center justify-center text-5xl mb-4 bg-gami-bg border border-gami-border"
                  style={nft.glow ? {
                    background: 'linear-gradient(135deg, rgba(110,60,251,0.1), rgba(0,245,160,0.05))'
                  } : {}}
                >
                  {nft.emoji}
                </div>
                <div className="font-display font-semibold text-white text-sm">{nft.name}</div>
                <div className="text-xs font-mono text-gami-muted mt-0.5">{nft.collection}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs font-mono border px-1.5 py-0.5 ${rarityText[nft.rarity]} border-current`}>
                    {nft.rarity}
                  </span>
                  <span className="text-xs font-mono text-white">{nft.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="bg-gami-surface border border-gami-border shadow-brutal">
            <div className="grid grid-cols-5 px-6 py-3 border-b border-gami-border text-xs font-mono text-gami-muted uppercase tracking-widest">
              <span>Type</span>
              <span>Amount</span>
              <span>Value</span>
              <span>Hash</span>
              <span className="text-right">Time</span>
            </div>
            {history.map((tx, i) => (
              <div key={i} className="grid grid-cols-5 px-6 py-4 border-b border-gami-border hover:bg-gami-bg transition-colors items-center">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 flex items-center justify-center ${
                    tx.type === 'Received' || tx.type === 'Quest Reward' || tx.type === 'Staking Reward'
                      ? 'bg-gami-green text-gami-bg'
                      : tx.type === 'Sent' || tx.type === 'NFT Purchase'
                      ? 'bg-gami-red text-white'
                      : 'bg-gami-purple text-white'
                  }`}>
                    {tx.type === 'Received' || tx.type === 'Quest Reward' || tx.type === 'Staking Reward'
                      ? <ArrowDownLeft size={12} />
                      : tx.type === 'Bridge'
                      ? <ArrowLeftRight size={12} />
                      : <ArrowUpRight size={12} />}
                  </div>
                  <span className="text-xs font-body text-white">{tx.type}</span>
                </div>
                <span className={`font-mono text-sm font-semibold ${
                  tx.amount.startsWith('+') ? 'text-gami-green' : 'text-gami-red'
                }`}>{tx.amount}</span>
                <span className="font-mono text-sm text-white">{tx.value}</span>
                <span className="font-mono text-xs text-gami-muted">{tx.hash}</span>
                <span className="font-mono text-xs text-gami-muted text-right">{tx.time}</span>
              </div>
            ))}
          </div>
        )}

        {/* BRIDGE TAB */}
        {tab === 'bridge' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-gami-surface border border-gami-border p-8 shadow-brutal">
              <h2 className="font-display font-bold text-xl text-white mb-6">Cross-Chain Bridge</h2>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-2">From Chain</label>
                  <select
                    value={fromChain}
                    onChange={(e) => setFromChain(e.target.value)}
                    className="w-full bg-gami-bg border border-gami-border px-4 py-3 text-white font-body text-sm focus:outline-none focus:border-gami-purple"
                  >
                    {chains.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => { const tmp = fromChain; setFromChain(toChain); setToChain(tmp) }}
                    className="w-10 h-10 bg-gami-purple flex items-center justify-center text-white shadow-brutal hover:shadow-brutal-purple transition-all"
                  >
                    <ArrowLeftRight size={16} />
                  </button>
                </div>

                <div>
                  <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-2">To Chain</label>
                  <select
                    value={toChain}
                    onChange={(e) => setToChain(e.target.value)}
                    className="w-full bg-gami-bg border border-gami-border px-4 py-3 text-white font-body text-sm focus:outline-none focus:border-gami-purple"
                  >
                    {chains.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-2">Token</label>
                  <select className="w-full bg-gami-bg border border-gami-border px-4 py-3 text-white font-body text-sm focus:outline-none focus:border-gami-purple">
                    {tokens.map((t) => (
                      <option key={t.symbol} value={t.symbol}>
                        {t.symbol} — {t.balance} available
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-2">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      defaultValue="100"
                      className="w-full bg-gami-bg border border-gami-border px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-gami-purple"
                    />
                    <button className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gami-purple">
                      MAX
                    </button>
                  </div>
                </div>

                <div className="bg-gami-bg border border-gami-border p-4 space-y-2">
                  {[
                    { label: 'Bridge Fee', value: '0.1%' },
                    { label: 'Estimated Time', value: '~2 minutes' },
                    { label: 'XP Bonus', value: '+25 XP' },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between text-xs font-mono">
                      <span className="text-gami-muted">{r.label}</span>
                      <span className={r.label === 'XP Bonus' ? 'text-gami-green' : 'text-white'}>{r.value}</span>
                    </div>
                  ))}
                </div>

                <button className="w-full bg-gami-purple text-white font-display font-semibold py-4 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-0.5 transition-all">
                  Bridge Tokens — {fromChain} → {toChain}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
