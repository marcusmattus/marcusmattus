import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Users, Zap, Star, ArrowRight, Gift } from 'lucide-react'
import { Link } from 'react-router-dom'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'

// Target date: 90 days from the first time this module is loaded so the
// countdown is always active in development and demo environments.
const TARGET_DATE = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

function useCountdown() {
  const calc = () => {
    const now = new Date()
    const diff = Math.max(TARGET_DATE.getTime() - now.getTime(), 0)
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    }
  }
  const [time, setTime] = useState(calc())
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const icoTiers = [
  {
    tier: 'Seed',
    price: '$0.05',
    allocation: '50M GAMI',
    bonus: '100% bonus',
    min: '$500',
    max: '$10,000',
    status: 'Closed',
    statusColor: 'text-gami-muted border-gami-muted',
    progress: 100,
  },
  {
    tier: 'Private',
    price: '$0.12',
    allocation: '100M GAMI',
    bonus: '50% bonus',
    min: '$1,000',
    max: '$50,000',
    status: 'Closed',
    statusColor: 'text-gami-muted border-gami-muted',
    progress: 100,
  },
  {
    tier: 'Public A',
    price: '$0.20',
    allocation: '150M GAMI',
    bonus: '25% bonus',
    min: '$100',
    max: '$25,000',
    status: 'Open',
    statusColor: 'text-gami-green border-gami-green',
    progress: 67,
  },
  {
    tier: 'Public B',
    price: '$0.30',
    allocation: '100M GAMI',
    bonus: 'No bonus',
    min: '$100',
    max: 'Unlimited',
    status: 'Upcoming',
    statusColor: 'text-gami-yellow border-gami-yellow',
    progress: 0,
  },
]

const perks = [
  { icon: '⚡', title: 'Early XP Multiplier', desc: 'Waitlist members get 2x XP for the first 90 days post-launch' },
  { icon: '🎖️', title: 'Genesis Badge NFT', desc: 'Exclusive NFT badge marking you as a founding community member' },
  { icon: '🪙', title: 'Whitelist Allocation', desc: 'Guaranteed allocation in the Public A ICO round at $0.20/GAMI' },
  { icon: '🔑', title: 'Beta Access', desc: 'Early access to the Builder Dashboard and AI Agent features' },
]

const referralLeaders = [
  { rank: 1, name: 'DeFiKing.eth', referrals: 847, xp: '84,700 XP' },
  { rank: 2, name: 'GamiMax', referrals: 623, xp: '62,300 XP' },
  { rank: 3, name: 'CryptoQuest', referrals: 441, xp: '44,100 XP' },
  { rank: 4, name: 'You', referrals: 3, xp: '300 XP' },
]

export default function Waitlist() {
  const { days, hours, minutes, seconds } = useCountdown()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const refLink = 'gami.xyz/ref/usr_abc123'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />

      {/* Hero with Countdown */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden text-center">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none animate-pulse-glow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(110,60,251,0.2) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="inline-flex items-center gap-2 bg-gami-surface border border-gami-green px-4 py-1.5 mb-8">
            <div className="w-2 h-2 bg-gami-green animate-pulse" />
            <span className="text-xs font-mono text-gami-green uppercase tracking-widest">
              Protocol Launches in:
            </span>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-4 mb-10 flex-wrap">
            {[
              { value: days, label: 'Days' },
              { value: hours, label: 'Hours' },
              { value: minutes, label: 'Minutes' },
              { value: seconds, label: 'Seconds' },
            ].map((unit, i) => (
              <div key={unit.label} className="flex items-center gap-4">
                <div className="text-center">
                  <div
                    className="bg-gami-surface border border-gami-border w-24 h-24 flex items-center justify-center shadow-brutal"
                  >
                    <span className="font-mono font-bold text-white" style={{ fontSize: '2.5rem' }}>
                      {pad(unit.value)}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-gami-muted mt-2 uppercase tracking-widest">
                    {unit.label}
                  </div>
                </div>
                {i < 3 && (
                  <span className="font-mono text-gami-purple text-3xl font-bold mb-5">:</span>
                )}
              </div>
            ))}
          </div>

          <h1 className="font-display font-bold text-white mb-4" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
            Be First to the<br />
            <span className="text-gami-purple">XP Economy</span>
          </h1>
          <p className="text-gami-muted font-body text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Join 12,847+ developers and players on the Gami Protocol waitlist.
            Get early access, whitelist spots, and Genesis NFT badges.
          </p>

          {/* Email Form */}
          {!submitted ? (
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="flex-1 bg-gami-surface border border-gami-border px-5 py-4 text-white font-body placeholder-gami-muted focus:outline-none focus:border-gami-purple transition-colors"
              />
              <button
                type="submit"
                className="flex items-center gap-2 bg-gami-purple text-white font-display font-bold px-7 py-4 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-0.5 transition-all whitespace-nowrap"
              >
                Join Now <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-lg mx-auto bg-gami-surface border border-gami-green p-6 shadow-brutal"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gami-green flex items-center justify-center">
                  <Check size={20} className="text-gami-bg" strokeWidth={3} />
                </div>
                <div>
                  <div className="font-display font-bold text-white">You're on the list! 🎉</div>
                  <div className="text-xs font-mono text-gami-green">Position #12,848 · Genesis Member</div>
                </div>
              </div>
              <p className="text-gami-muted text-sm font-body">
                Share your referral link to move up the list and earn bonus XP.
              </p>
            </motion.div>
          )}

          <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gami-muted">
            <span className="flex items-center gap-1.5">
              <Users size={14} className="text-gami-green" />
              12,847 on waitlist
            </span>
            <span className="flex items-center gap-1.5">
              <Star size={14} className="text-gami-yellow" fill="currentColor" />
              4,231 whitelist spots
            </span>
            <span className="flex items-center gap-1.5">
              <Gift size={14} className="text-gami-accent" />
              Genesis NFT for first 1,000
            </span>
          </div>
        </motion.div>
      </section>

      {/* Perks */}
      <section className="py-16 px-6 bg-gami-surface border-y border-gami-border">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Waitlist Perks</span>
            <h2 className="font-display font-bold text-2xl text-white mt-2">Why join early?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {perks.map((perk) => (
              <div
                key={perk.title}
                className="bg-gami-bg border border-gami-border p-5 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all"
              >
                <div className="text-3xl mb-3">{perk.icon}</div>
                <h3 className="font-display font-semibold text-white text-sm mb-2">{perk.title}</h3>
                <p className="text-gami-muted text-xs font-body leading-relaxed">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ICO Tiers Table */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Token Sale</span>
          <h2 className="font-display font-bold text-3xl text-white mt-2">ICO Rounds</h2>
          <p className="text-gami-muted font-body mt-3">
            Waitlist members get guaranteed allocation in the Public A round.
          </p>
        </div>

        <div className="bg-gami-surface border border-gami-border shadow-brutal overflow-hidden">
          <div className="grid grid-cols-7 px-6 py-3 border-b border-gami-border text-xs font-mono text-gami-muted uppercase tracking-widest">
            <span>Round</span>
            <span>Price</span>
            <span>Allocation</span>
            <span>Bonus</span>
            <span>Min/Max</span>
            <span className="col-span-2">Progress</span>
          </div>
          {icoTiers.map((tier) => (
            <div
              key={tier.tier}
              className={`grid grid-cols-7 px-6 py-5 border-b border-gami-border items-center ${
                tier.status === 'Open' ? 'bg-gami-bg' : 'hover:bg-gami-bg transition-colors'
              }`}
            >
              <div>
                <div className="font-display font-semibold text-white">{tier.tier}</div>
                <span className={`text-xs font-mono border px-1.5 py-0.5 mt-1 inline-block ${tier.statusColor}`}>
                  {tier.status}
                </span>
              </div>
              <span className="font-mono text-gami-green font-bold text-lg">{tier.price}</span>
              <span className="font-mono text-white text-sm">{tier.allocation}</span>
              <span className="font-mono text-gami-yellow text-sm">{tier.bonus}</span>
              <div className="text-xs font-mono text-gami-muted">
                <div>{tier.min}</div>
                <div>{tier.max}</div>
              </div>
              <div className="col-span-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-mono text-gami-muted">{tier.progress}% filled</span>
                  {tier.status === 'Open' && (
                    <span className="text-xs font-mono text-gami-green animate-pulse">● Live</span>
                  )}
                </div>
                <div className="w-full h-2 bg-gami-bg border border-gami-border">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${tier.progress}%`,
                      background: tier.status === 'Open' ? '#6E3CFB' : tier.progress === 100 ? '#6B7280' : '#2A2A3A',
                      boxShadow: tier.status === 'Open' ? '0 0 10px rgba(110,60,251,0.5)' : 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            to="/token-economy"
            className="flex items-center gap-2 text-sm font-body text-gami-muted hover:text-white transition-colors"
          >
            Learn about tokenomics <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Referral Tracker */}
      <section className="py-16 px-6 bg-gami-surface border-y border-gami-border">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Referral Link */}
            <div>
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Your Referral</span>
              <h2 className="font-display font-bold text-2xl text-white mt-2 mb-4">
                Move up the list
              </h2>
              <p className="text-gami-muted font-body mb-6 leading-relaxed">
                Each referral earns you <span className="text-gami-green font-mono">+100 XP</span> and
                moves you <span className="text-gami-yellow font-mono">+10 positions</span> up the waitlist.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-2">
                    Your Referral Link
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-gami-bg border border-gami-border px-4 py-3 font-mono text-gami-green text-sm truncate">
                      {refLink}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 bg-gami-purple text-white font-display font-semibold px-4 py-3 shadow-brutal hover:shadow-brutal-purple transition-all"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Your Referrals', value: '3', color: 'text-gami-green' },
                    { label: 'XP Earned', value: '300', color: 'text-gami-yellow' },
                    { label: 'Position', value: '#12,845', color: 'text-gami-accent' },
                  ].map((s) => (
                    <div key={s.label} className="bg-gami-bg border border-gami-border p-3 text-center shadow-brutal-sm">
                      <div className={`font-mono font-bold text-lg ${s.color}`}>{s.value}</div>
                      <div className="text-xs font-mono text-gami-muted mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-gami-bg border border-gami-border p-4">
                  <div className="text-xs font-mono text-gami-muted mb-2">Referral Progress</div>
                  <div className="w-full h-2 bg-gami-border">
                    <div
                      className="h-full bg-gami-green"
                      style={{ width: '30%', boxShadow: '0 0 10px rgba(0,245,160,0.5)' }}
                    />
                  </div>
                  <div className="text-xs font-mono text-gami-muted mt-1.5">
                    3 / 10 referrals to unlock Genesis Badge
                  </div>
                </div>
              </div>
            </div>

            {/* Leaderboard */}
            <div>
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Top Referrers</span>
              <h2 className="font-display font-bold text-2xl text-white mt-2 mb-4">Referral Leaderboard</h2>
              <div className="bg-gami-bg border border-gami-border shadow-brutal">
                {referralLeaders.map((p, i) => (
                  <div
                    key={p.rank}
                    className={`flex items-center justify-between px-5 py-4 border-b border-gami-border ${
                      p.name === 'You' ? 'bg-gami-surface' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 flex items-center justify-center font-mono font-bold text-sm ${
                        i === 0 ? 'bg-gami-yellow text-gami-bg' :
                        i === 1 ? 'bg-gami-muted text-gami-bg' :
                        i === 2 ? 'bg-amber-700 text-white' :
                        'bg-gami-border text-gami-muted'
                      }`}>
                        {p.rank}
                      </div>
                      <span className={`font-display font-semibold text-sm ${p.name === 'You' ? 'text-gami-yellow' : 'text-white'}`}>
                        {p.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-gami-green text-sm">{p.referrals} refs</div>
                      <div className="font-mono text-gami-muted text-xs">{p.xp}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs font-mono text-gami-muted">
                <Zap size={12} className="text-gami-yellow" />
                Top 10 referrers get Diamond Staking tier access at launch
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display font-bold text-3xl text-white mb-4">
            The future of engagement is on-chain.
          </h2>
          <p className="text-gami-muted font-body mb-8">
            Don't miss the genesis window. Join the waitlist and secure your spot.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-gami-purple text-white font-display font-bold px-10 py-4 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all"
          >
            Learn More About Gami <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
