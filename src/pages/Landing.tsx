import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Zap, Copy, Check, ArrowRight, Shield, Brain, Globe, Coins, Code2, Lock,
  ChevronRight, Star, TrendingUp
} from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

function useCountUp(target: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      setCount(Math.floor(progress * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, start])
  return count
}

const sdkSnippet = `import { GamiProtocol } from '@gami/sdk'

const gami = new GamiProtocol({ appId: 'app_xyz123' })

// Award XP for any user action
await gami.xp.award({
  userId: 'usr_abc123',
  action: 'purchase_completed',
  metadata: { amount: 49.99, currency: 'USD' }
})

// Check quest progress
const quests = await gami.quests.getActive('usr_abc123')
// → [{ id: 'q_1', title: 'First Purchase', progress: 0.6 }]`

const features = [
  {
    icon: <Zap size={24} className="text-gami-yellow" />,
    title: 'XP Engine',
    desc: 'Real-time XP calculation with custom multipliers, decay curves, and cross-app aggregation.',
    tag: 'CORE',
  },
  {
    icon: <Brain size={24} className="text-gami-accent" />,
    title: 'AI Quest Agent',
    desc: 'LLM-powered quest generation and personalized challenge recommendations per user segment.',
    tag: 'AI',
  },
  {
    icon: <Globe size={24} className="text-gami-green" />,
    title: 'Cross-App Identity',
    desc: 'Single player identity across every app in the Gami ecosystem. One wallet, all games.',
    tag: 'IDENTITY',
  },
  {
    icon: <Coins size={24} className="text-gami-yellow" />,
    title: 'Token Rewards',
    desc: '$GAMI token distribution engine with on-chain settlement and gasless meta-transactions.',
    tag: 'DEFI',
  },
  {
    icon: <Code2 size={24} className="text-gami-purple" />,
    title: 'Rules DSL',
    desc: 'Declarative YAML-based rules engine. Define quests, triggers, and conditions without code.',
    tag: 'DEV',
  },
  {
    icon: <Shield size={24} className="text-gami-red" />,
    title: 'Fraud Shield',
    desc: 'ML-based bot detection, Sybil resistance, and on-chain reputation scoring for every player.',
    tag: 'SECURITY',
  },
]

const partners = [
  'Polygon', 'Solana', 'Arbitrum', 'OpenSea', 'Uniswap', 'Aave',
  'Chainlink', 'The Graph', 'Alchemy', 'Infura', 'Base', 'Optimism',
]

const stats = [
  { label: 'XP Awarded', value: 2400000000, display: '2.4B', suffix: ' XP' },
  { label: 'Active Players', value: 847000, display: '847K', suffix: '' },
  { label: 'Apps Integrated', value: 312, display: '312', suffix: '' },
  { label: 'Tokens Distributed', value: 12400000, display: '$12.4M', suffix: '' },
]

const howItWorks = [
  {
    num: '01',
    title: 'Integrate the SDK',
    desc: 'One npm install, five lines of code. Works with any frontend framework or backend.',
    code: `npm install @gami/sdk`,
  },
  {
    num: '02',
    title: 'Define Your Rules',
    desc: 'Write quest logic in YAML or use the visual builder. Deploy in under 60 seconds.',
    code: `quests:\n  - id: first_purchase\n    trigger: purchase_completed\n    xp_reward: 500`,
  },
  {
    num: '03',
    title: 'Watch Players Engage',
    desc: 'Real-time XP, leaderboards, and $GAMI rewards — all on-chain, all automatic.',
    code: `→ XP Awarded: +500\n→ Quest: "First Purchase" ✓\n→ Rank: #4,821 globally`,
  },
]

export default function Landing() {
  const [copied, setCopied] = useState(false)
  const [statsVisible, setStatsVisible] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true) },
      { threshold: 0.3 }
    )
    if (statsRef.current) observer.observe(statsRef.current)
    return () => observer.disconnect()
  }, [])

  const xpCount = useCountUp(2400000000, 2500, statsVisible)
  const playerCount = useCountUp(847000, 2000, statsVisible)
  const appCount = useCountUp(312, 1800, statsVisible)
  const tokenCount = useCountUp(12400000, 2200, statsVisible)

  const formatStat = (idx: number) => {
    if (idx === 0) return xpCount >= 1000000000 ? `${(xpCount / 1000000000).toFixed(1)}B` : `${Math.floor(xpCount / 1000000)}M`
    if (idx === 1) return playerCount >= 1000 ? `${(playerCount / 1000).toFixed(0)}K` : playerCount
    if (idx === 2) return appCount
    if (idx === 3) return `$${tokenCount >= 1000000 ? `${(tokenCount / 1000000).toFixed(1)}M` : tokenCount}`
    return ''
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(sdkSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        {/* Animated blob bg */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(110,60,251,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none animate-pulse-glow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(110,60,251,0.25) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Floating App Icons */}
        <div className="absolute top-32 left-12 animate-float hidden lg:block">
          <div className="w-14 h-14 bg-gami-surface border border-gami-border shadow-brutal flex items-center justify-center">
            <span className="text-2xl">🎮</span>
          </div>
          <div className="w-1 h-8 bg-gami-green mx-auto opacity-50" />
          <div className="text-xs font-mono text-gami-green text-center">+120 XP</div>
        </div>
        <div className="absolute top-40 right-16 animate-float-delay hidden lg:block">
          <div className="w-14 h-14 bg-gami-surface border border-gami-border shadow-brutal flex items-center justify-center">
            <span className="text-2xl">💎</span>
          </div>
          <div className="w-1 h-8 bg-gami-accent mx-auto opacity-50" />
          <div className="text-xs font-mono text-gami-accent text-center">+500 XP</div>
        </div>
        <div className="absolute bottom-48 left-24 animate-float-delay-2 hidden lg:block">
          <div className="w-14 h-14 bg-gami-surface border border-gami-border shadow-brutal flex items-center justify-center">
            <span className="text-2xl">⚡</span>
          </div>
          <div className="w-1 h-8 bg-gami-yellow mx-auto opacity-50" />
          <div className="text-xs font-mono text-gami-yellow text-center">+250 XP</div>
        </div>
        <div className="absolute bottom-56 right-28 animate-float hidden lg:block">
          <div className="w-14 h-14 bg-gami-surface border border-gami-border shadow-brutal flex items-center justify-center">
            <span className="text-2xl">🏆</span>
          </div>
          <div className="w-1 h-8 bg-gami-purple mx-auto opacity-50" />
          <div className="text-xs font-mono text-gami-purple text-center">+1000 XP</div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-gami-surface border border-gami-purple px-4 py-2 mb-8 shadow-brutal-sm">
              <div className="w-2 h-2 bg-gami-green animate-pulse" />
              <span className="text-xs font-mono text-gami-accent uppercase tracking-widest">
                Protocol V1 Now Live on Mainnet
              </span>
              <ChevronRight size={12} className="text-gami-accent" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display font-bold text-white mb-6 leading-none"
            style={{ fontSize: 'clamp(40px, 7vw, 72px)' }}
          >
            Universal{' '}
            <span className="gradient-text">Gamification</span>
            <br />
            Infrastructure
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-gami-muted font-body text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Add XP, quests, leaderboards, and on-chain rewards to any app in minutes.
            The protocol powers engagement for 847K+ players across 312 apps.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <Link
              to="/builder"
              className="flex items-center gap-2 bg-gami-purple text-white font-display font-semibold px-8 py-4 text-lg shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all"
            >
              Start Building Free
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/docs"
              className="flex items-center gap-2 bg-transparent text-white font-display font-semibold px-8 py-4 text-lg border border-gami-border shadow-brutal hover:shadow-[8px_8px_0px_0px_#fff] hover:-translate-y-1 transition-all"
            >
              <Code2 size={18} />
              View Docs
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8 flex items-center justify-center gap-6 text-sm text-gami-muted font-body"
          >
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-gami-green" /> No credit card
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-gami-green" /> Free tier available
            </span>
            <span className="flex items-center gap-1.5">
              <Check size={14} className="text-gami-green" /> Deploy in 5 minutes
            </span>
          </motion.div>
        </div>
      </section>

      {/* SCROLLING MARQUEE TICKER */}
      <div className="border-y border-gami-border bg-gami-surface py-3 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 pr-8">
              {['XP ENGINE', 'QUEST BUILDER', 'AI AGENT', '$GAMI TOKEN', 'CROSS-CHAIN', 'FRAUD SHIELD',
                'LEADERBOARDS', 'NFT REWARDS', 'REAL-TIME XP', 'ON-CHAIN IDENTITY', 'RULES DSL', 'WEBHOOKS'].map((item) => (
                <span key={item} className="flex items-center gap-2 text-gami-muted text-sm font-mono uppercase tracking-widest">
                  <span className="text-gami-purple">✦</span> {item}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-gami-purple uppercase tracking-widest">How It Works</span>
          <h2 className="font-display font-bold text-4xl text-white mt-2">
            Ship gamification in minutes
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {howItWorks.map((step) => (
            <div
              key={step.num}
              className="bg-gami-surface border border-gami-border p-8 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all group"
            >
              <div className="font-display font-bold text-6xl text-gami-border group-hover:text-gami-purple transition-colors mb-6">
                {step.num}
              </div>
              <h3 className="font-display font-semibold text-xl text-white mb-3">{step.title}</h3>
              <p className="text-gami-muted font-body text-sm leading-relaxed mb-6">{step.desc}</p>
              <div className="bg-gami-bg border border-gami-border p-4">
                <pre className="text-gami-green text-xs font-mono whitespace-pre-wrap">{step.code}</pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* LIVE STATS */}
      <div ref={statsRef} className="bg-gami-surface border-y border-gami-border py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Live Protocol Metrics</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, idx) => (
              <div
                key={stat.label}
                className="text-center bg-gami-bg border border-gami-border p-8 shadow-brutal"
              >
                <div className="font-display font-bold text-white mb-1" style={{ fontSize: '2.5rem' }}>
                  <span className="xp-number">{formatStat(idx)}</span>
                  {stat.suffix && (
                    <span className="text-gami-muted text-xl ml-1">{stat.suffix}</span>
                  )}
                </div>
                <p className="text-gami-muted text-sm font-body">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono text-gami-purple uppercase tracking-widest">Protocol Features</span>
          <h2 className="font-display font-bold text-4xl text-white mt-2">
            Everything you need to gamify
          </h2>
          <p className="text-gami-muted font-body mt-4 max-w-xl mx-auto">
            Battle-tested infrastructure powering the next generation of engaging applications.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-gami-surface border border-gami-border p-6 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gami-bg border border-gami-border flex items-center justify-center">
                  {f.icon}
                </div>
                <span className="text-xs font-mono text-gami-muted border border-gami-border px-2 py-0.5">
                  {f.tag}
                </span>
              </div>
              <h3 className="font-display font-semibold text-white text-lg mb-2">{f.title}</h3>
              <p className="text-gami-muted font-body text-sm leading-relaxed">{f.desc}</p>
              <div className="mt-4 flex items-center gap-1 text-gami-purple text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more <ChevronRight size={14} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DEVELOPER CTA — SDK Snippet */}
      <section className="py-24 px-6 bg-gami-surface border-y border-gami-border">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-xs font-mono text-gami-purple uppercase tracking-widest">For Developers</span>
            <h2 className="font-display font-bold text-4xl text-white mt-3 mb-4">
              Five lines to gamify<br />anything.
            </h2>
            <p className="text-gami-muted font-body text-lg leading-relaxed mb-8">
              Our SDK handles XP calculation, quest management, leaderboards, and on-chain rewards.
              You focus on your product.
            </p>
            <div className="flex gap-3">
              <Link
                to="/docs"
                className="flex items-center gap-2 bg-gami-purple text-white font-display font-semibold px-6 py-3 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-0.5 transition-all"
              >
                Read Docs <ArrowRight size={16} />
              </Link>
              <Link
                to="/builder"
                className="flex items-center gap-2 border border-gami-border text-white font-display font-semibold px-6 py-3 shadow-brutal hover:shadow-[8px_8px_0px_0px_#fff] hover:-translate-y-0.5 transition-all"
              >
                Open Builder
              </Link>
            </div>
          </div>

          {/* Code snippet */}
          <div className="bg-gami-bg border border-gami-border shadow-brutal">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gami-border">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gami-red" />
                <div className="w-3 h-3 bg-gami-yellow" />
                <div className="w-3 h-3 bg-gami-green" />
              </div>
              <span className="text-xs font-mono text-gami-muted">quickstart.ts</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-mono text-gami-muted hover:text-white transition-colors px-2 py-1 border border-gami-border hover:border-gami-purple"
              >
                {copied ? <Check size={12} className="text-gami-green" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="p-6 overflow-x-auto">
              <pre className="text-sm font-mono leading-relaxed">
                {sdkSnippet.split('\n').map((line, i) => {
                  let colored = line
                    .replace(/^(import|const|await)/g, '<span class="text-gami-purple">$1</span>')
                    .replace(/('.*?')/g, '<span class="text-gami-green">$1</span>')
                    .replace(/(\/\/.*)/g, '<span class="text-gami-muted">$1</span>')
                    .replace(/(→.*)/g, '<span class="text-gami-accent">$1</span>')
                  return (
                    <div key={i} className="text-gami-white">
                      <span dangerouslySetInnerHTML={{ __html: colored || '&nbsp;' }} />
                    </div>
                  )
                })}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* PARTNER LOGOS MARQUEE */}
      <section className="py-16 px-6 border-b border-gami-border overflow-hidden">
        <div className="text-center mb-10">
          <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">
            Integrated with the leading protocols
          </span>
        </div>
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-8 pr-8">
              {partners.map((p) => (
                <div
                  key={p}
                  className="bg-gami-surface border border-gami-border px-6 py-3 text-gami-muted font-display font-semibold text-sm hover:text-white hover:border-gami-purple transition-colors cursor-pointer"
                >
                  {p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={20} className="text-gami-yellow" fill="currentColor" />
            ))}
            <span className="text-gami-muted text-sm font-body ml-2">
              Rated 4.9/5 by 200+ developers
            </span>
          </div>
          <h2 className="font-display font-bold text-white mb-6" style={{ fontSize: '3rem' }}>
            Start building the future<br />of engagement.
          </h2>
          <p className="text-gami-muted font-body text-xl mb-10">
            Join 312 apps already on Gami Protocol. Free tier includes 10,000 XP events/month.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              to="/waitlist"
              className="flex items-center gap-2 bg-gami-green text-gami-bg font-display font-bold px-10 py-4 text-lg shadow-brutal hover:shadow-brutal-green hover:-translate-y-1 transition-all"
            >
              Join the Waitlist <TrendingUp size={18} />
            </Link>
            <Link
              to="/auth"
              className="flex items-center gap-2 border border-gami-border text-white font-display font-semibold px-10 py-4 text-lg shadow-brutal hover:shadow-[8px_8px_0px_0px_#fff] hover:-translate-y-1 transition-all"
            >
              Connect Wallet
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
