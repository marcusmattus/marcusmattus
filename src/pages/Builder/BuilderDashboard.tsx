import { useState } from 'react'
import {
  BarChart2, Code2, Gift, Settings, Webhook, LayoutDashboard,
  Target, Copy, Check, Play, ChevronRight, TrendingUp, Users, Zap
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, ResponsiveContainer,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import Navbar from '../../components/layout/Navbar'

type BuilderSection = 'overview' | 'campaigns' | 'quests' | 'rewards' | 'analytics' | 'webhooks' | 'settings'

const yamlExample = `quests:
  - id: first_purchase
    title: "First Purchase"
    description: "Make your first purchase in the app"
    trigger:
      event: purchase_completed
      conditions:
        - field: amount
          operator: gte
          value: 1
    rewards:
      xp: 500
      badge: "early_buyer"
      tokens:
        amount: 10
        currency: GAMI
    ui:
      icon: "🛒"
      color: "#6E3CFB"
      difficulty: Easy
    expiry:
      type: rolling
      days: 30
    fraud_check: true`

const analyticsData = [
  { day: 'Mon', xp: 12400, players: 234, quests: 89 },
  { day: 'Tue', xp: 18200, players: 312, quests: 124 },
  { day: 'Wed', xp: 15600, players: 278, quests: 105 },
  { day: 'Thu', xp: 22800, players: 401, quests: 167 },
  { day: 'Fri', xp: 19400, players: 356, quests: 142 },
  { day: 'Sat', xp: 28600, players: 489, quests: 198 },
  { day: 'Sun', xp: 24200, players: 421, quests: 175 },
]

const campaigns = [
  { name: 'Summer DeFi Sprint', status: 'Active', players: 1247, budget: '$5,000', xpGiven: '124,500', endDate: 'Aug 31' },
  { name: 'NFT Collector Series', status: 'Active', players: 832, budget: '$3,200', xpGiven: '83,200', endDate: 'Sep 15' },
  { name: 'Referral Blitz', status: 'Paused', players: 421, budget: '$1,500', xpGiven: '42,100', endDate: 'Sep 30' },
  { name: 'Genesis Quest Pack', status: 'Draft', players: 0, budget: '$8,000', xpGiven: '0', endDate: 'Oct 1' },
]

const kpis = [
  { label: 'Total Players', value: '12,847', change: '+18%', icon: <Users size={16} className="text-gami-accent" /> },
  { label: 'XP Distributed', value: '1.2M', change: '+34%', icon: <Zap size={16} className="text-gami-yellow" /> },
  { label: 'Quest Completions', value: '8,421', change: '+22%', icon: <Target size={16} className="text-gami-green" /> },
  { label: 'Retention Rate', value: '68.4%', change: '+5.2%', icon: <TrendingUp size={16} className="text-gami-purple" /> },
]

const sideNav: { id: BuilderSection; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { id: 'campaigns', label: 'Campaigns', icon: <Target size={16} /> },
  { id: 'quests', label: 'Quest Builder', icon: <Code2 size={16} /> },
  { id: 'rewards', label: 'Rewards', icon: <Gift size={16} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart2 size={16} /> },
  { id: 'webhooks', label: 'Webhooks', icon: <Webhook size={16} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
]

const webhooks = [
  { event: 'quest.completed', url: 'https://api.myapp.com/webhooks/gami', status: 'Active', calls: '12,847' },
  { event: 'xp.awarded', url: 'https://api.myapp.com/webhooks/xp', status: 'Active', calls: '48,231' },
  { event: 'level.up', url: 'https://api.myapp.com/webhooks/level', status: 'Error', calls: '1,042' },
]

export default function BuilderDashboard() {
  const [section, setSection] = useState<BuilderSection>('overview')
  const [yaml, setYaml] = useState(yamlExample)
  const [copied, setCopied] = useState(false)

  const handleCopyYaml = () => {
    navigator.clipboard.writeText(yaml)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-16 flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-56 bg-gami-surface border-r border-gami-border fixed left-0 top-16 bottom-0">
          <div className="p-5 border-b border-gami-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gami-purple flex items-center justify-center">
                <Code2 size={14} className="text-white" />
              </div>
              <div>
                <div className="font-display font-semibold text-white text-sm">Builder</div>
                <div className="text-xs font-mono text-gami-green">app_xyz123</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4">
            {sideNav.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-body mb-1 transition-colors text-left ${
                  section === item.id
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
            <div className="bg-gami-bg border border-gami-border p-3 text-center">
              <div className="text-xs font-mono text-gami-muted">API Calls This Month</div>
              <div className="font-mono font-bold text-gami-green text-lg mt-1">48,231</div>
              <div className="w-full h-1 bg-gami-border mt-2">
                <div className="h-full bg-gami-green" style={{ width: '48%' }} />
              </div>
              <div className="text-xs font-mono text-gami-muted mt-1">48% of 100K limit</div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-56 p-6 lg:p-8">
          {/* OVERVIEW */}
          {section === 'overview' && (
            <div>
              <div className="mb-8">
                <h1 className="font-display font-bold text-2xl text-white">Builder Dashboard</h1>
                <p className="text-gami-muted text-sm font-body mt-1">Manage your gamification campaigns and quests</p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="bg-gami-surface border border-gami-border p-5 shadow-brutal">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono text-gami-muted">{kpi.label}</span>
                      {kpi.icon}
                    </div>
                    <div className="font-display font-bold text-white text-2xl">{kpi.value}</div>
                    <div className="text-xs font-mono text-gami-green mt-1">{kpi.change} this month</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                  <h3 className="font-display font-semibold text-white mb-4">XP Distributed (7d)</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                      <XAxis dataKey="day" tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#16161E', border: '1px solid #2A2A3A', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
                      <Line type="monotone" dataKey="xp" stroke="#6E3CFB" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                  <h3 className="font-display font-semibold text-white mb-4">Daily Active Players</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                      <XAxis dataKey="day" tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#16161E', border: '1px solid #2A2A3A', borderRadius: 0, fontFamily: 'JetBrains Mono' }} />
                      <Bar dataKey="players" fill="#00F5A0" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gami-surface border border-gami-border shadow-brutal">
                <div className="px-6 py-4 border-b border-gami-border flex items-center justify-between">
                  <h3 className="font-display font-semibold text-white">Active Campaigns</h3>
                  <button
                    onClick={() => setSection('campaigns')}
                    className="text-xs font-mono text-gami-purple flex items-center gap-1"
                  >
                    View all <ChevronRight size={12} />
                  </button>
                </div>
                {campaigns.slice(0, 3).map((c) => (
                  <div key={c.name} className="px-6 py-4 border-b border-gami-border flex items-center justify-between hover:bg-gami-bg transition-colors">
                    <div>
                      <div className="font-display font-semibold text-white text-sm">{c.name}</div>
                      <div className="text-xs font-mono text-gami-muted mt-0.5">Ends: {c.endDate}</div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs font-mono text-gami-muted">Players</div>
                        <div className="font-mono text-white text-sm">{c.players.toLocaleString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono text-gami-muted">XP Given</div>
                        <div className="font-mono text-gami-green text-sm">{c.xpGiven}</div>
                      </div>
                      <span className={`text-xs font-mono px-2 py-0.5 border ${
                        c.status === 'Active' ? 'text-gami-green border-gami-green' :
                        c.status === 'Paused' ? 'text-gami-yellow border-gami-yellow' :
                        'text-gami-muted border-gami-muted'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAMPAIGNS */}
          {section === 'campaigns' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h1 className="font-display font-bold text-2xl text-white">Campaigns</h1>
                <button className="flex items-center gap-2 bg-gami-purple text-white font-display font-semibold px-5 py-2.5 shadow-brutal hover:shadow-brutal-purple transition-all">
                  + New Campaign
                </button>
              </div>
              <div className="bg-gami-surface border border-gami-border shadow-brutal">
                <div className="grid grid-cols-6 px-6 py-3 border-b border-gami-border text-xs font-mono text-gami-muted uppercase tracking-widest">
                  <span className="col-span-2">Campaign</span>
                  <span>Players</span>
                  <span>Budget</span>
                  <span>XP Given</span>
                  <span className="text-right">Status</span>
                </div>
                {campaigns.map((c) => (
                  <div key={c.name} className="grid grid-cols-6 px-6 py-4 border-b border-gami-border hover:bg-gami-bg transition-colors items-center">
                    <div className="col-span-2">
                      <div className="font-display font-semibold text-white text-sm">{c.name}</div>
                      <div className="text-xs font-mono text-gami-muted mt-0.5">Ends: {c.endDate}</div>
                    </div>
                    <span className="font-mono text-white">{c.players.toLocaleString()}</span>
                    <span className="font-mono text-white">{c.budget}</span>
                    <span className="font-mono text-gami-green">{c.xpGiven}</span>
                    <div className="flex justify-end">
                      <span className={`text-xs font-mono px-2 py-0.5 border ${
                        c.status === 'Active' ? 'text-gami-green border-gami-green' :
                        c.status === 'Paused' ? 'text-gami-yellow border-gami-yellow' :
                        'text-gami-muted border-gami-muted'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QUEST BUILDER */}
          {section === 'quests' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h1 className="font-display font-bold text-2xl text-white">Quest Builder</h1>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyYaml}
                    className="flex items-center gap-2 border border-gami-border text-white font-display font-semibold px-4 py-2 shadow-brutal-sm hover:border-gami-purple transition-all text-sm"
                  >
                    {copied ? <Check size={14} className="text-gami-green" /> : <Copy size={14} />}
                    Copy YAML
                  </button>
                  <button className="flex items-center gap-2 bg-gami-green text-gami-bg font-display font-bold px-4 py-2 shadow-brutal hover:shadow-brutal-green transition-all text-sm">
                    <Play size={14} /> Deploy Quest
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* YAML Editor */}
                <div className="bg-gami-surface border border-gami-border shadow-brutal">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gami-border bg-gami-bg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-gami-red" />
                      <div className="w-3 h-3 bg-gami-yellow" />
                      <div className="w-3 h-3 bg-gami-green" />
                    </div>
                    <span className="text-xs font-mono text-gami-muted">quest-definition.yaml</span>
                    <span className="text-xs font-mono text-gami-green">● Valid YAML</span>
                  </div>
                  <div className="relative">
                    <div className="absolute top-0 left-0 bottom-0 w-10 bg-gami-bg border-r border-gami-border flex flex-col items-center pt-4 gap-1">
                      {yaml.split('\n').map((_, i) => (
                        <div key={i} className="text-xs font-mono text-gami-border leading-5 w-full text-center">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <textarea
                      value={yaml}
                      onChange={(e) => setYaml(e.target.value)}
                      spellCheck={false}
                      className="w-full bg-transparent text-gami-green font-mono text-xs p-4 pl-14 focus:outline-none resize-none leading-5"
                      style={{ minHeight: '520px' }}
                    />
                  </div>
                </div>

                {/* Live Preview */}
                <div className="bg-gami-surface border border-gami-border shadow-brutal">
                  <div className="px-4 py-3 border-b border-gami-border bg-gami-bg flex items-center justify-between">
                    <span className="text-xs font-mono text-gami-muted">Live Preview</span>
                    <span className="text-xs font-mono text-gami-accent">Auto-updating</span>
                  </div>
                  <div className="p-6">
                    <div className="bg-gami-bg border border-gami-border p-5 shadow-brutal-sm mb-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🛒</span>
                          <div>
                            <div className="font-display font-semibold text-white text-sm">First Purchase</div>
                            <div className="text-xs font-mono text-gami-muted">Commerce · Easy</div>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-gami-green border border-gami-green px-1.5 py-0.5">Easy</span>
                      </div>
                      <p className="text-gami-muted text-xs font-body mb-4">
                        Make your first purchase in the app
                      </p>
                      <div className="w-full h-1.5 bg-gami-border mb-2">
                        <div className="h-full bg-gami-green w-0" />
                      </div>
                      <div className="flex justify-between text-xs font-mono text-gami-muted">
                        <span>Not started</span>
                        <span>Expires in 30d</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gami-border flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Zap size={12} className="text-gami-yellow" fill="currentColor" />
                          <span className="text-xs font-mono text-gami-yellow">+500 XP</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-gami-accent">🪙 +10 GAMI</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-gami-purple">🎖️ early_buyer</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-mono text-gami-muted uppercase tracking-widest">Trigger Config</div>
                      {[
                        { key: 'Event', val: 'purchase_completed' },
                        { key: 'Condition', val: 'amount >= 1' },
                        { key: 'Fraud Check', val: 'Enabled' },
                        { key: 'Expiry', val: 'Rolling 30 days' },
                      ].map((row) => (
                        <div key={row.key} className="flex items-center justify-between bg-gami-bg border border-gami-border px-3 py-2">
                          <span className="text-xs font-mono text-gami-muted">{row.key}</span>
                          <span className="text-xs font-mono text-gami-green">{row.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ANALYTICS */}
          {section === 'analytics' && (
            <div>
              <h1 className="font-display font-bold text-2xl text-white mb-8">Analytics</h1>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                  <h3 className="font-display font-semibold text-white mb-4">XP Over Time</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                      <XAxis dataKey="day" tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#16161E', border: '1px solid #2A2A3A', borderRadius: 0 }} />
                      <Line type="monotone" dataKey="xp" stroke="#6E3CFB" strokeWidth={2} dot={{ fill: '#6E3CFB' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                  <h3 className="font-display font-semibold text-white mb-4">Quest Completions</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
                      <XAxis dataKey="day" tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#6B7280', fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#16161E', border: '1px solid #2A2A3A', borderRadius: 0 }} />
                      <Bar dataKey="quests" fill="#00F5A0" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                  <h3 className="font-display font-semibold text-white mb-4">Player Retention Funnel</h3>
                  <div className="space-y-3 mt-6">
                    {[
                      { stage: 'Registered', count: 12847, pct: 100, color: '#6E3CFB' },
                      { stage: 'First Quest', count: 9634, pct: 75, color: '#9C6CFF' },
                      { stage: 'Level 5+', count: 7123, pct: 55, color: '#00F5A0' },
                      { stage: '7-Day Active', count: 4712, pct: 37, color: '#F5C518' },
                      { stage: '30-Day Active', count: 2568, pct: 20, color: '#FF4444' },
                    ].map((stage) => (
                      <div key={stage.stage} className="flex items-center gap-3">
                        <div className="w-28 text-xs font-mono text-gami-muted text-right">{stage.stage}</div>
                        <div className="flex-1 h-6 bg-gami-bg border border-gami-border">
                          <div
                            className="h-full flex items-center px-2 transition-all"
                            style={{ width: `${stage.pct}%`, background: stage.color }}
                          >
                            <span className="text-xs font-mono text-gami-bg font-bold">{stage.count.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="w-12 text-xs font-mono text-gami-muted">{stage.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                  <h3 className="font-display font-semibold text-white mb-4">Engagement Heatmap</h3>
                  <div className="mt-4">
                    <div className="grid grid-cols-8 gap-1 mb-2">
                      {['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <div key={d} className="text-center text-xs font-mono text-gami-muted">{d}</div>
                      ))}
                    </div>
                    {['12am', '6am', '12pm', '6pm'].map((hour) => (
                      <div key={hour} className="grid grid-cols-8 gap-1 mb-1">
                        <div className="text-xs font-mono text-gami-muted text-right pr-1 leading-4">{hour}</div>
                        {Array.from({ length: 7 }, (_, i) => {
                          const intensity = Math.random()
                          return (
                            <div
                              key={i}
                              className="h-4"
                              style={{
                                background: intensity > 0.7
                                  ? '#6E3CFB'
                                  : intensity > 0.4
                                  ? '#4B24B8'
                                  : '#2A2A3A',
                              }}
                            />
                          )
                        })}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 mt-3 justify-end">
                      <span className="text-xs font-mono text-gami-muted">Less</span>
                      {['#2A2A3A', '#4B24B8', '#6E3CFB', '#9C6CFF'].map((c) => (
                        <div key={c} className="w-3 h-3" style={{ background: c }} />
                      ))}
                      <span className="text-xs font-mono text-gami-muted">More</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WEBHOOKS */}
          {section === 'webhooks' && (
            <div>
              <div className="flex items-center justify-between mb-8">
                <h1 className="font-display font-bold text-2xl text-white">Webhooks</h1>
                <button className="flex items-center gap-2 bg-gami-purple text-white font-display font-semibold px-5 py-2.5 shadow-brutal hover:shadow-brutal-purple transition-all">
                  + Add Webhook
                </button>
              </div>
              <div className="bg-gami-surface border border-gami-border shadow-brutal">
                <div className="grid grid-cols-4 px-6 py-3 border-b border-gami-border text-xs font-mono text-gami-muted uppercase tracking-widest">
                  <span>Event</span>
                  <span className="col-span-2">Endpoint URL</span>
                  <span className="text-right">Status / Calls</span>
                </div>
                {webhooks.map((w) => (
                  <div key={w.event} className="grid grid-cols-4 px-6 py-4 border-b border-gami-border hover:bg-gami-bg items-center">
                    <span className="font-mono text-gami-accent text-sm">{w.event}</span>
                    <span className="col-span-2 font-mono text-gami-muted text-xs truncate">{w.url}</span>
                    <div className="flex items-center justify-end gap-3">
                      <span className="font-mono text-white text-xs">{w.calls}</span>
                      <span className={`text-xs font-mono border px-2 py-0.5 ${
                        w.status === 'Active' ? 'text-gami-green border-gami-green' : 'text-gami-red border-gami-red'
                      }`}>
                        {w.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REWARDS & SETTINGS (simplified) */}
          {section === 'rewards' && (
            <div>
              <h1 className="font-display font-bold text-2xl text-white mb-8">Rewards Configuration</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { title: 'XP Multipliers', items: ['Base: 1x', 'Weekend: 2x', 'New User: 3x', 'VIP: 5x'], color: 'text-gami-green' },
                  { title: 'Token Rewards', items: ['Quest Completion: 10 GAMI', 'Level Up: 25 GAMI', 'Referral: 50 GAMI', 'Daily Bonus: 5 GAMI'], color: 'text-gami-yellow' },
                  { title: 'Badge Tiers', items: ['Bronze: 1,000 XP', 'Silver: 5,000 XP', 'Gold: 20,000 XP', 'Diamond: 100,000 XP'], color: 'text-gami-accent' },
                ].map((card) => (
                  <div key={card.title} className="bg-gami-surface border border-gami-border p-6 shadow-brutal">
                    <h3 className="font-display font-semibold text-white mb-4">{card.title}</h3>
                    <ul className="space-y-2">
                      {card.items.map((item) => (
                        <li key={item} className={`text-sm font-mono ${card.color} flex items-center gap-2`}>
                          <span className="w-1 h-1 bg-current" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'settings' && (
            <div>
              <h1 className="font-display font-bold text-2xl text-white mb-8">App Settings</h1>
              <div className="max-w-2xl space-y-6">
                {[
                  { label: 'App Name', value: 'My DeFi App', type: 'text' },
                  { label: 'App ID', value: 'app_xyz123', type: 'text' },
                  { label: 'Webhook Secret', value: '••••••••••••••••', type: 'password' },
                  { label: 'Default XP Multiplier', value: '1', type: 'number' },
                ].map((field) => (
                  <div key={field.label} className="bg-gami-surface border border-gami-border p-5 shadow-brutal">
                    <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-2">{field.label}</label>
                    <input
                      type={field.type}
                      defaultValue={field.value}
                      className="w-full bg-gami-bg border border-gami-border px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-gami-purple"
                    />
                  </div>
                ))}
                <button className="bg-gami-purple text-white font-display font-semibold px-8 py-3 shadow-brutal hover:shadow-brutal-purple transition-all">
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
