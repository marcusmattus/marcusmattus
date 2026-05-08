import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Zap, Trophy, Target, Gift, BarChart2, Settings, Wallet,
  TrendingUp, Star, Globe, Bell, ChevronRight, Copy, Check,
  Home, MessageSquare, Flame
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts'
import Navbar from '../../components/layout/Navbar'
import XPBar from '../../components/xp/XPBar'
import QuestCard from '../../components/xp/QuestCard'
import StreakBadge from '../../components/xp/StreakBadge'

const sparklineData = [
  { xp: 100 }, { xp: 450 }, { xp: 200 }, { xp: 800 }, { xp: 600 },
  { xp: 1200 }, { xp: 900 }, { xp: 1500 }, { xp: 1100 }, { xp: 1800 },
  { xp: 1400 }, { xp: 2100 }, { xp: 1900 }, { xp: 2400 },
]

const donutData = [
  { name: 'Purchases', value: 8500, color: '#6E3CFB' },
  { name: 'Social', value: 6200, color: '#00F5A0' },
  { name: 'Quests', value: 5100, color: '#F5C518' },
  { name: 'Referrals', value: 3050, color: '#9C6CFF' },
  { name: 'Bonus', value: 2000, color: '#FF4444' },
]

const activity = [
  { action: 'Completed "First Purchase" quest', xp: '+500 XP', time: '2m ago', icon: '🎯', color: 'text-gami-green' },
  { action: 'Daily login streak bonus', xp: '+50 XP', time: '1h ago', icon: '🔥', color: 'text-gami-yellow' },
  { action: 'Referred a new player', xp: '+200 XP', time: '3h ago', icon: '👥', color: 'text-gami-accent' },
  { action: 'Polygon Quest progress +30%', xp: '+0 XP', time: '5h ago', icon: '⚡', color: 'text-gami-muted' },
  { action: 'NFT purchase on OpenSea', xp: '+150 XP', time: '1d ago', icon: '💎', color: 'text-gami-green' },
  { action: 'Discord Champion badge earned', xp: '+75 XP', time: '2d ago', icon: '🏆', color: 'text-gami-yellow' },
]

const inventory = [
  { name: 'Cyber Blade', type: 'NFT', rarity: 'Legendary', emoji: '⚔️' },
  { name: 'XP Boost x2', type: 'Boost', rarity: 'Rare', expires: '3d', emoji: '⚡' },
  { name: 'Genesis Badge', type: 'Badge', rarity: 'Epic', emoji: '🎖️' },
  { name: '500 GAMI', type: 'Token', rarity: 'Common', emoji: '🪙' },
]

const rarityColors: Record<string, string> = {
  Legendary: 'text-gami-yellow border-gami-yellow',
  Epic: 'text-gami-accent border-gami-accent',
  Rare: 'text-gami-purple border-gami-purple',
  Common: 'text-gami-muted border-gami-muted',
}

const navItems = [
  { icon: <Home size={16} />, label: 'Overview', active: true },
  { icon: <Target size={16} />, label: 'Quests' },
  { icon: <Trophy size={16} />, label: 'Leaderboard' },
  { icon: <Gift size={16} />, label: 'Rewards' },
  { icon: <BarChart2 size={16} />, label: 'Analytics' },
  { icon: <MessageSquare size={16} />, label: 'AI Agent' },
  { icon: <Wallet size={16} />, label: 'Wallet' },
  { icon: <Settings size={16} />, label: 'Settings' },
]

const weeklyChallenge = {
  title: 'DeFi Week Challenge',
  desc: 'Make 3 DeFi transactions to earn 2x XP multiplier',
  progress: 66,
  endsIn: '4d 12h',
  xpBonus: '2500 XP',
}

export default function XPDashboard() {
  const [copied, setCopied] = useState(false)
  const refLink = 'gami.xyz/ref/usr_abc123'

  const handleCopy = () => {
    navigator.clipboard.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-16 flex min-h-screen">
        {/* LEFT SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-60 bg-gami-surface border-r border-gami-border fixed left-0 top-16 bottom-0 overflow-y-auto">
          {/* Avatar */}
          <div className="p-6 border-b border-gami-border">
            <div className="relative mb-4">
              <div className="w-16 h-16 bg-gami-purple flex items-center justify-center text-2xl shadow-brutal-sm relative">
                🧑‍💻
                {/* Level ring */}
                <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-gami-yellow flex items-center justify-center shadow-brutal-sm">
                  <span className="text-gami-bg text-xs font-mono font-bold">42</span>
                </div>
              </div>
            </div>
            <div className="font-display font-semibold text-white text-sm">CryptoPlayer</div>
            <div className="text-xs font-mono text-gami-muted mt-0.5 truncate">usr_abc123</div>
            <div className="mt-4">
              <XPBar current={24850} max={30000} level={42} />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-body mb-1 transition-colors text-left ${
                  item.active
                    ? 'bg-gami-purple text-white shadow-brutal-sm'
                    : 'text-gami-muted hover:text-white hover:bg-gami-bg'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gami-border">
            <Link
              to="/agent"
              className="flex items-center gap-2 w-full bg-gami-purple text-white text-xs font-display font-semibold px-3 py-2.5 shadow-brutal-sm hover:shadow-brutal-purple transition-all"
            >
              <Zap size={12} fill="currentColor" />
              Ask AI Agent
            </Link>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 lg:ml-60 lg:mr-72 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display font-bold text-2xl text-white">XP Dashboard</h1>
              <p className="text-gami-muted text-sm font-body mt-1">
                LVL 42 · Rank <span className="text-gami-yellow font-mono">#4,821</span> globally
              </p>
            </div>
            <button className="relative p-2 border border-gami-border text-gami-muted hover:text-white transition-colors">
              <Bell size={18} />
              <div className="absolute top-1 right-1 w-2 h-2 bg-gami-red" />
            </button>
          </div>

          {/* XP Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="md:col-span-2 bg-gami-surface border border-gami-border p-6 shadow-brutal">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Total XP</span>
                  <div className="font-mono font-bold text-gami-green mt-1" style={{ fontSize: '3rem', lineHeight: 1 }}>
                    24,850
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <TrendingUp size={12} className="text-gami-green" />
                    <span className="text-xs font-mono text-gami-green">+1,240 XP this week</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-gami-muted">Next Level</div>
                  <div className="font-mono text-white text-lg">5,150 XP</div>
                  <div className="text-xs font-mono text-gami-muted">to LVL 43</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={sparklineData}>
                  <Line
                    type="monotone"
                    dataKey="xp"
                    stroke="#00F5A0"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#16161E', border: '1px solid #2A2A3A', borderRadius: 0 }}
                    labelStyle={{ display: 'none' }}
                    itemStyle={{ color: '#00F5A0', fontFamily: 'JetBrains Mono' }}
                    formatter={(v) => [`${v} XP`, '']}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal flex flex-col items-center justify-center">
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest mb-4">XP Sources</span>
              <PieChart width={140} height={140}>
                <Pie data={donutData} cx={65} cy={65} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
              <div className="mt-4 space-y-1 w-full">
                {donutData.slice(0, 3).map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 inline-block" style={{ background: d.color }} />
                      <span className="text-gami-muted">{d.name}</span>
                    </span>
                    <span style={{ color: d.color }}>{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Quests */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white">Active Quests</h2>
              <button className="text-xs font-mono text-gami-purple hover:text-gami-accent transition-colors flex items-center gap-1">
                View all <ChevronRight size={12} />
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              <QuestCard
                title="First Purchase"
                description="Make your first purchase on any integrated app to unlock this quest reward."
                progress={60}
                xpReward={500}
                timeRemaining="2d left"
                category="Commerce"
                difficulty="Easy"
              />
              <QuestCard
                title="Polygon Quest"
                description="Complete 5 transactions on the Polygon network to earn the Polygon Pioneer badge."
                progress={30}
                xpReward={750}
                timeRemaining="5d left"
                category="DeFi"
                difficulty="Medium"
              />
              <QuestCard
                title="Discord Champion"
                description="Participate in 10 community discussions and earn the Discord Champion title."
                progress={85}
                xpReward={1000}
                timeRemaining="1d left"
                category="Social"
                difficulty="Hard"
              />
              <QuestCard
                title="DeFi Degen"
                description="Provide liquidity on 3 different protocols to prove your DeFi expertise."
                progress={10}
                xpReward={2000}
                timeRemaining="7d left"
                category="DeFi"
                difficulty="Epic"
              />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-white">Recent Activity</h2>
            </div>
            <div className="bg-gami-surface border border-gami-border shadow-brutal divide-y divide-gami-border">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gami-bg transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-sm font-body text-gami-muted">{a.action}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono font-semibold ${a.color}`}>{a.xp}</span>
                    <span className="text-xs font-mono text-gami-muted">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rewards Inventory */}
          <div>
            <h2 className="font-display font-semibold text-white mb-4">Rewards Inventory</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {inventory.map((item) => (
                <div
                  key={item.name}
                  className="bg-gami-surface border border-gami-border p-4 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all cursor-pointer"
                >
                  <div className="text-3xl mb-3">{item.emoji}</div>
                  <div className="font-display font-semibold text-white text-sm">{item.name}</div>
                  <div className="text-xs font-mono text-gami-muted mt-0.5">{item.type}</div>
                  <div className={`mt-2 text-xs font-mono border px-1.5 py-0.5 inline-block ${rarityColors[item.rarity]}`}>
                    {item.rarity}
                  </div>
                  {item.expires && (
                    <div className="text-xs font-mono text-gami-red mt-1">Expires: {item.expires}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside className="hidden lg:flex flex-col w-72 bg-gami-surface border-l border-gami-border fixed right-0 top-16 bottom-0 overflow-y-auto p-5 gap-5">
          {/* Streak */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Daily Streak</span>
              <StreakBadge streak={14} size="sm" />
            </div>
            <div className="grid grid-cols-7 gap-1 mt-3">
              {Array.from({ length: 14 }, (_, i) => (
                <div
                  key={i}
                  className="aspect-square flex items-center justify-center"
                  title={`Day ${i + 1}`}
                >
                  <Flame
                    size={16}
                    className={i < 14 ? 'text-gami-yellow' : 'text-gami-border'}
                    fill={i < 14 ? 'currentColor' : 'none'}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs font-mono text-gami-muted mt-3">
              🔥 Keep it up! +50 bonus XP tomorrow.
            </p>
          </div>

          {/* Global Rank */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Global Rank</span>
            <div className="flex items-end gap-2 mt-2">
              <span className="font-mono font-bold text-gami-yellow text-3xl">#4,821</span>
              <span className="text-xs font-mono text-gami-green pb-1 flex items-center gap-0.5">
                <TrendingUp size={10} /> +342 this week
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { rank: 1, name: 'CryptoKing', xp: '142,500' },
                { rank: 2, name: 'DeFiDragon', xp: '138,200' },
                { rank: 3, name: 'NFTNinja', xp: '126,800' },
              ].map((p) => (
                <div key={p.rank} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gami-muted">#{p.rank} {p.name}</span>
                  <span className="text-gami-green">{p.xp} XP</span>
                </div>
              ))}
              <div className="border-t border-gami-border pt-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gami-yellow">#4,821 You</span>
                  <span className="text-gami-yellow">24,850 XP</span>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Challenge */}
          <div className="bg-gami-bg border border-gami-purple p-4 shadow-brutal-purple">
            <div className="flex items-center gap-2 mb-2">
              <Star size={14} className="text-gami-yellow" fill="currentColor" />
              <span className="text-xs font-mono text-gami-yellow uppercase tracking-widest">Weekly Challenge</span>
            </div>
            <h3 className="font-display font-semibold text-white text-sm mb-1">{weeklyChallenge.title}</h3>
            <p className="text-gami-muted text-xs font-body leading-relaxed mb-3">{weeklyChallenge.desc}</p>
            <div className="w-full h-1.5 bg-gami-border mb-1.5">
              <div
                className="h-full bg-gami-purple transition-all"
                style={{ width: `${weeklyChallenge.progress}%`, boxShadow: '0 0 8px rgba(110,60,251,0.6)' }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-gami-muted">{weeklyChallenge.progress}% done</span>
              <span className="text-gami-accent">Ends in {weeklyChallenge.endsIn}</span>
            </div>
            <div className="mt-3 bg-gami-surface border border-gami-border p-2 text-center">
              <span className="text-xs font-mono text-gami-yellow">Reward: {weeklyChallenge.xpBonus}</span>
            </div>
          </div>

          {/* Referral Link */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Referral Link</span>
            <p className="text-xs font-body text-gami-muted mt-2 mb-3">
              Earn <span className="text-gami-green font-mono">+200 XP</span> for every friend you refer.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gami-surface border border-gami-border px-3 py-2 text-xs font-mono text-gami-muted truncate">
                {refLink}
              </div>
              <button
                onClick={handleCopy}
                className="w-9 h-9 bg-gami-purple flex items-center justify-center text-white hover:shadow-brutal-purple transition-all flex-shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-3 text-xs font-mono text-gami-muted">
              <span className="text-gami-accent">3 referrals</span> this month
            </div>
          </div>

          {/* XP Breakdown */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest mb-3 block">
              XP Breakdown
            </span>
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2" style={{ background: d.color }} />
                  <span className="text-xs font-mono text-gami-muted">{d.name}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: d.color }}>
                  {d.value.toLocaleString()} XP
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
