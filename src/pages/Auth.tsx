import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Wallet, Mail, Lock, User, ArrowRight, Check, Chrome, Github } from 'lucide-react'

type Tab = 'player' | 'partner' | 'admin'

export default function Auth() {
  const [tab, setTab] = useState<Tab>('player')
  const [connected, setConnected] = useState(false)
  const navigate = useNavigate()

  const handleConnect = () => {
    setConnected(true)
    setTimeout(() => navigate('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-gami-bg flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gami-surface border-r border-gami-border relative overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 pointer-events-none animate-pulse-glow"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(110,60,251,0.3) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="w-9 h-9 bg-gami-purple flex items-center justify-center shadow-brutal">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="font-display font-bold text-xl text-white">
            GAMI<span className="text-gami-green">.</span>
          </span>
        </Link>

        <div className="relative z-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-gami-bg border border-gami-border px-3 py-1.5 mb-6 shadow-brutal-sm">
              <div className="w-2 h-2 bg-gami-green animate-pulse" />
              <span className="text-xs font-mono text-gami-green">LIVE — 847K Players Online</span>
            </div>
            <h1 className="font-display font-bold text-4xl text-white mb-4 leading-tight">
              Your gateway to the<br />
              <span className="text-gami-purple">XP economy.</span>
            </h1>
            <p className="text-gami-muted font-sans text-lg leading-relaxed">
              One identity. Every app. All your XP, quests, and rewards in one place.
            </p>
          </div>

          {/* Mock stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Your XP', value: '24,850', color: 'text-gami-green' },
              { label: 'Rank', value: '#4,821', color: 'text-gami-yellow' },
              { label: 'Level', value: '42', color: 'text-gami-accent' },
            ].map((s) => (
              <div key={s.label} className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
                <div className={`font-mono font-bold text-xl ${s.color}`}>{s.value}</div>
                <div className="text-xs font-sans text-gami-muted mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs font-mono text-gami-muted">
          © 2024 Gami Protocol — v1.0.0
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link to="/" className="flex items-center gap-2 lg:hidden mb-6">
              <div className="w-8 h-8 bg-gami-purple flex items-center justify-center">
                <Zap size={16} className="text-white" fill="white" />
              </div>
              <span className="font-display font-bold text-lg text-white">GAMI.</span>
            </Link>
            <h2 className="font-display font-bold text-2xl text-white mb-1">Welcome back</h2>
            <p className="text-gami-muted font-sans text-sm">Connect your wallet or sign in to continue</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-gami-surface border border-gami-border mb-6 shadow-brutal-sm">
            {(['player', 'partner', 'admin'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-sm font-display font-semibold transition-colors capitalize ${
                  tab === t
                    ? 'bg-gami-purple text-white'
                    : 'text-gami-muted hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {!connected ? (
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {/* Wallet Connect */}
                <div className="bg-gami-surface border border-gami-border p-6 mb-4 shadow-brutal">
                  <h3 className="font-display font-semibold text-white text-sm mb-4 uppercase tracking-widest">
                    Connect Wallet
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: 'MetaMask', icon: '🦊' },
                      { name: 'Phantom', icon: '👻' },
                      { name: 'WalletConnect', icon: '🔗' },
                      { name: 'Coinbase', icon: '🔵' },
                    ].map((w) => (
                      <button
                        key={w.name}
                        onClick={handleConnect}
                        className="flex items-center gap-2 bg-gami-bg border border-gami-border p-3 hover:border-gami-purple hover:shadow-brutal-sm transition-all text-left"
                      >
                        <span className="text-lg">{w.icon}</span>
                        <span className="text-sm font-sans text-white">{w.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gami-border" />
                  <span className="text-xs font-mono text-gami-muted">OR</span>
                  <div className="flex-1 h-px bg-gami-border" />
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button className="flex items-center justify-center gap-2 bg-gami-surface border border-gami-border py-3 text-sm font-sans text-white hover:border-gami-purple transition-colors shadow-brutal-sm">
                    <Chrome size={16} />
                    Google
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-gami-surface border border-gami-border py-3 text-sm font-sans text-white hover:border-gami-purple transition-colors shadow-brutal-sm">
                    <Github size={16} />
                    GitHub
                  </button>
                </div>

                {/* Email Form */}
                {tab !== 'admin' && (
                  <div className="space-y-3">
                    {tab === 'partner' && (
                      <div className="relative">
                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gami-muted" />
                        <input
                          type="text"
                          placeholder="Company name"
                          className="w-full bg-gami-surface border border-gami-border pl-9 pr-4 py-3 text-sm font-sans text-white placeholder-gami-muted focus:outline-none focus:border-gami-purple transition-colors"
                        />
                      </div>
                    )}
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gami-muted" />
                      <input
                        type="email"
                        placeholder="Email address"
                        className="w-full bg-gami-surface border border-gami-border pl-9 pr-4 py-3 text-sm font-sans text-white placeholder-gami-muted focus:outline-none focus:border-gami-purple transition-colors"
                      />
                    </div>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gami-muted" />
                      <input
                        type="password"
                        placeholder="Password"
                        className="w-full bg-gami-surface border border-gami-border pl-9 pr-4 py-3 text-sm font-sans text-white placeholder-gami-muted focus:outline-none focus:border-gami-purple transition-colors"
                      />
                    </div>
                    <button
                      onClick={handleConnect}
                      className="w-full flex items-center justify-center gap-2 bg-gami-purple text-white font-display font-semibold py-3 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-0.5 transition-all"
                    >
                      Sign In <ArrowRight size={16} />
                    </button>
                  </div>
                )}

                {tab === 'admin' && (
                  <div className="space-y-3">
                    <div className="relative">
                      <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gami-muted" />
                      <input
                        type="text"
                        placeholder="Admin access code"
                        className="w-full bg-gami-surface border border-gami-border pl-9 pr-4 py-3 text-sm font-mono text-white placeholder-gami-muted focus:outline-none focus:border-gami-purple transition-colors"
                      />
                    </div>
                    <button
                      onClick={handleConnect}
                      className="w-full flex items-center justify-center gap-2 bg-gami-red text-white font-display font-semibold py-3 shadow-brutal hover:-translate-y-0.5 transition-all"
                    >
                      Admin Access <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 bg-gami-green mx-auto flex items-center justify-center mb-6 shadow-brutal-green animate-pulse-glow">
                  <Check size={36} className="text-gami-bg" strokeWidth={3} />
                </div>
                <h3 className="font-display font-bold text-2xl text-white mb-2">
                  Welcome back! 🎮
                </h3>
                <p className="text-gami-muted font-sans text-sm mb-4">
                  Connected as <span className="font-mono text-gami-green">0x742d...d8e</span>
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-gami-green animate-pulse" />
                  <span className="text-gami-muted text-sm font-mono">Redirecting to dashboard...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-xs font-sans text-gami-muted mt-6">
            Don't have an account?{' '}
            <Link to="/waitlist" className="text-gami-purple hover:text-gami-accent transition-colors">
              Join the waitlist
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
