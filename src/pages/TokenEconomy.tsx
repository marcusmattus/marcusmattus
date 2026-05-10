import { useRef } from 'react'
import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Zap, Shield, Vote, TrendingUp, Lock, Coins } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

const supplyData = [
  { name: 'Community', value: 40, color: '#6E3CFB' },
  { name: 'Ecosystem', value: 20, color: '#00F5A0' },
  { name: 'Team', value: 15, color: '#F5C518' },
  { name: 'Public Sale', value: 15, color: '#9C6CFF' },
  { name: 'Liquidity', value: 10, color: '#FF4444' },
]

const stakingTiers = [
  {
    tier: 'Bronze',
    emoji: '🥉',
    required: '1,000 GAMI',
    apy: '8%',
    xpBonus: '1.5x',
    perks: ['Quest XP Boost', 'Early Access', 'Bronze Badge'],
    color: '#CD7F32',
    shadow: '8px 8px 0px 0px #CD7F32',
  },
  {
    tier: 'Silver',
    emoji: '🥈',
    required: '10,000 GAMI',
    apy: '14%',
    xpBonus: '2x',
    perks: ['2x XP All Events', 'Priority Support', 'Silver Badge', 'Governance Vote'],
    color: '#C0C0C0',
    shadow: '8px 8px 0px 0px #C0C0C0',
  },
  {
    tier: 'Gold',
    emoji: '🥇',
    required: '50,000 GAMI',
    apy: '22%',
    xpBonus: '3x',
    perks: ['3x XP Multiplier', 'Protocol Revenue Share', 'Gold Badge', 'Early Quest Access'],
    color: '#FFD700',
    shadow: '8px 8px 0px 0px #FFD700',
  },
  {
    tier: 'Diamond',
    emoji: '💎',
    required: '250,000 GAMI',
    apy: '36%',
    xpBonus: '5x',
    perks: ['5x XP Multiplier', 'Max Revenue Share', 'Diamond Badge', 'Protocol Governance', 'Private Alpha'],
    color: '#00F5A0',
    shadow: '8px 8px 0px 0px #00F5A0',
  },
]

const utilities = [
  {
    icon: <Zap size={24} className="text-gami-yellow" />,
    title: 'Quest Rewards',
    desc: 'Earned automatically for completing quests across integrated apps. Direct on-chain distribution.',
  },
  {
    icon: <Shield size={24} className="text-gami-green" />,
    title: 'Protocol Staking',
    desc: 'Stake $GAMI to earn yield, boost XP multipliers, and access exclusive protocol features.',
  },
  {
    icon: <Vote size={24} className="text-gami-accent" />,
    title: 'Governance',
    desc: '1 GAMI = 1 vote. Shape the future of the protocol: quest types, fee parameters, integrations.',
  },
  {
    icon: <TrendingUp size={24} className="text-gami-purple" />,
    title: 'Builder Payments',
    desc: 'Apps pay protocol fees in $GAMI. 80% redistributed to stakers, 20% burned quarterly.',
  },
  {
    icon: <Lock size={24} className="text-gami-red" />,
    title: 'Access Gating',
    desc: 'Hold $GAMI to access premium quest tiers, exclusive NFT drops, and private alpha features.',
  },
  {
    icon: <Coins size={24} className="text-gami-yellow" />,
    title: 'Liquidity Incentives',
    desc: 'Provide liquidity on Uniswap/Curve to earn boosted $GAMI emissions and protocol NFTs.',
  },
]

const tokenStats = [
  { label: 'Total Supply', value: '1,000,000,000', unit: 'GAMI' },
  { label: 'Circulating', value: '247,500,000', unit: 'GAMI' },
  { label: 'Burned', value: '12,850,000', unit: 'GAMI' },
  { label: 'Market Cap', value: '$74.5M', unit: '' },
  { label: 'Token Price', value: '$0.298', unit: '' },
  { label: 'Staked', value: '48.2%', unit: 'of supply' },
]

// SVG Flow Diagram Nodes
const flowNodes = [
  { id: 'users', label: 'Players', x: 60, y: 150, color: '#6E3CFB' },
  { id: 'apps', label: 'Apps', x: 280, y: 80, color: '#00F5A0' },
  { id: 'protocol', label: 'Protocol', x: 480, y: 150, color: '#F5C518' },
  { id: 'stakers', label: 'Stakers', x: 700, y: 80, color: '#9C6CFF' },
  { id: 'treasury', label: 'Treasury', x: 700, y: 220, color: '#FF4444' },
]

export default function TokenEconomy() {
  // animRef is kept for any future imperative SVG access; animation is CSS-driven (no RAF state).
  const animRef = useRef<SVGPathElement>(null)

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden text-center">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none animate-pulse-glow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(245,197,24,0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 w-32 h-32 mx-auto mb-8 bg-gami-yellow flex items-center justify-center shadow-brutal"
          style={{ boxShadow: '8px 8px 0px 0px #000' }}
        >
          <span className="text-6xl animate-float">🪙</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="inline-flex items-center gap-2 bg-gami-surface border border-gami-yellow px-4 py-1.5 mb-6">
            <span className="text-xs font-mono text-gami-yellow uppercase tracking-widest">$GAMI Token</span>
          </div>
          <h1 className="font-display font-bold text-white mb-4" style={{ fontSize: 'clamp(36px, 6vw, 64px)' }}>
            $GAMI: The Currency of Play
          </h1>
          <p className="text-gami-muted font-sans text-xl max-w-2xl mx-auto leading-relaxed mb-10">
            The native token of the Gami Protocol ecosystem. Earn it by playing, stake it to earn,
            and use it to govern the future of on-chain gamification.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button className="bg-gami-yellow text-gami-bg font-display font-bold px-8 py-4 shadow-brutal hover:-translate-y-1 transition-all">
              Buy $GAMI
            </button>
            <button className="border border-gami-border text-white font-display font-semibold px-8 py-4 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all">
              Stake Now
            </button>
          </div>
        </motion.div>
      </section>

      {/* Token Stats */}
      <div className="border-y border-gami-border bg-gami-surface py-8 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tokenStats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-mono font-bold text-white text-lg">{s.value}</div>
              <div className="text-xs font-mono text-gami-muted mt-0.5">{s.label}</div>
              {s.unit && <div className="text-xs font-mono text-gami-yellow">{s.unit}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Utility Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-gami-yellow uppercase tracking-widest">Token Utility</span>
          <h2 className="font-display font-bold text-4xl text-white mt-2">Six ways to use $GAMI</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {utilities.map((u) => (
            <div
              key={u.title}
              className="bg-gami-surface border border-gami-border p-6 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 bg-gami-bg border border-gami-border flex items-center justify-center mb-4">
                {u.icon}
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-2">{u.title}</h3>
              <p className="text-gami-muted font-sans text-sm leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Supply Chart */}
      <section className="py-16 px-6 bg-gami-surface border-y border-gami-border">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Token Distribution</span>
            <h2 className="font-display font-bold text-3xl text-white mt-2 mb-4">1B GAMI Total Supply</h2>
            <div className="space-y-3">
              {supplyData.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 flex-shrink-0" style={{ background: d.color }} />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-sm font-sans text-gami-muted">{d.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-gami-bg border border-gami-border overflow-hidden">
                        <div className="h-full" style={{ width: `${d.value}%`, background: d.color }} />
                      </div>
                      <span className="text-sm font-mono text-white w-8 text-right">{d.value}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width={360} height={360}>
              <PieChart>
                <Pie
                  data={supplyData}
                  cx={175}
                  cy={175}
                  innerRadius={80}
                  outerRadius={160}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#0E0E12"
                >
                  {supplyData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#16161E', border: '1px solid #2A2A3A', borderRadius: 0, fontFamily: 'JetBrains Mono' }}
                  formatter={(v) => [`${v}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Staking Tiers */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Staking Program</span>
          <h2 className="font-display font-bold text-4xl text-white mt-2">Stake $GAMI, Earn More</h2>
          <p className="text-gami-muted font-sans mt-4">
            Lock your tokens to unlock multiplied yields and XP bonuses.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stakingTiers.map((tier) => (
            <div
              key={tier.tier}
              className="bg-gami-surface border border-gami-border p-6 hover:-translate-y-1 transition-all cursor-pointer"
              style={{ boxShadow: '8px 8px 0px 0px #000' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = tier.shadow }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '8px 8px 0px 0px #000' }}
            >
              <div className="text-4xl mb-4">{tier.emoji}</div>
              <h3 className="font-display font-bold text-2xl mb-1" style={{ color: tier.color }}>
                {tier.tier}
              </h3>
              <div className="text-xs font-mono text-gami-muted mb-4">{tier.required} min.</div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between">
                  <span className="text-xs font-mono text-gami-muted">APY</span>
                  <span className="text-sm font-mono font-bold" style={{ color: tier.color }}>{tier.apy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs font-mono text-gami-muted">XP Bonus</span>
                  <span className="text-sm font-mono font-bold text-gami-green">{tier.xpBonus}</span>
                </div>
              </div>

              <div className="border-t border-gami-border pt-4 space-y-1.5">
                {tier.perks.map((perk) => (
                  <div key={perk} className="flex items-center gap-2 text-xs font-sans text-gami-muted">
                    <span className="text-gami-green">✓</span> {perk}
                  </div>
                ))}
              </div>

              <button
                className="w-full mt-6 py-2.5 font-display font-semibold text-sm text-gami-bg"
                style={{ background: tier.color, boxShadow: '4px 4px 0px 0px #000' }}
              >
                Stake Now
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Token Flow Diagram */}
      <section className="py-16 px-6 bg-gami-surface border-y border-gami-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Token Flow</span>
            <h2 className="font-display font-bold text-3xl text-white mt-2">How $GAMI Circulates</h2>
          </div>
          <div className="overflow-x-auto">
            <svg viewBox="0 0 820 300" className="w-full max-w-4xl mx-auto" style={{ minWidth: '600px' }}>
              {/* Animated dashed paths */}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#6E3CFB" />
                </marker>
              </defs>

              {/* Paths */}
              {[
                { d: 'M 160 150 L 280 100', label: 'Fees', color: '#6E3CFB' },
                { d: 'M 280 100 L 480 150', label: 'Revenue', color: '#00F5A0' },
                { d: 'M 480 150 L 700 100', label: '80% to Stakers', color: '#F5C518' },
                { d: 'M 480 150 L 700 200', label: '20% Burned', color: '#FF4444' },
                { d: 'M 160 150 L 280 280 L 480 150', label: 'Quest Rewards', color: '#9C6CFF' },
              ].map((path, i) => (
                <g key={i}>
                  <path
                    d={path.d}
                    fill="none"
                    stroke={path.color}
                    strokeWidth="2"
                    strokeDasharray="8 4"
                    style={{ animation: 'dash-flow 2s linear infinite' }}
                    markerEnd="url(#arrowhead)"
                    opacity={0.8}
                  />
                </g>
              ))}

              {/* Nodes */}
              {flowNodes.map((node) => (
                <g key={node.id}>
                  <rect
                    x={node.x - 50}
                    y={node.y - 25}
                    width={100}
                    height={50}
                    fill="#16161E"
                    stroke={node.color}
                    strokeWidth="2"
                  />
                  <text
                    x={node.x}
                    y={node.y + 6}
                    textAnchor="middle"
                    fill={node.color}
                    fontFamily="Space Grotesk"
                    fontWeight="700"
                    fontSize="14"
                  >
                    {node.label}
                  </text>
                </g>
              ))}

              {/* Legend */}
              <text x="60" y="280" fill="#6B7280" fontFamily="JetBrains Mono" fontSize="11">
                Players pay fees → Protocol distributes → Stakers earn
              </text>
            </svg>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
