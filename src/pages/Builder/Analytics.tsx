import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import Navbar from '../../components/layout/Navbar'
import RetentionHeatmap from '../../components/charts/RetentionHeatmap'
import { MOCK_DAU_DATA } from '../../lib/mockData'

const XP_HISTOGRAM = [
  { bucket: '0-100', users: 4200 }, { bucket: '100-500', users: 8100 }, { bucket: '500-1k', users: 6300 },
  { bucket: '1k-5k', users: 3800 }, { bucket: '5k-10k', users: 1200 }, { bucket: '10k+', users: 420 },
]

const FUNNEL = [
  { stage: 'Saw Quest', value: 24800 }, { stage: 'Started', value: 18200 },
  { stage: 'In Progress', value: 11400 }, { stage: 'Completed', value: 7800 },
]

const TOP_QUESTS = [
  { name: 'Daily Login', rate: 94 }, { name: 'Discord Champion', rate: 71 },
  { name: 'First Purchase', rate: 58 }, { name: 'Trade Volume', rate: 42 },
  { name: 'NFT Collector', rate: 29 },
]

const TOKEN_SPEND = [
  { date: 'May 1', gami: 12400 }, { date: 'May 2', gami: 15200 }, { date: 'May 3', gami: 11800 },
  { date: 'May 4', gami: 9200 },  { date: 'May 5', gami: 14600 }, { date: 'May 6', gami: 18900 },
  { date: 'May 7', gami: 21200 }, { date: 'May 8', gami: 17400 },
]

const RANGE_OPTIONS = ['Last 7d', 'Last 30d', 'Last 90d', 'All Time']

const chartTooltipStyle = { contentStyle: { background: '#16161E', border: '1px solid #2A2A3A', fontFamily: 'JetBrains Mono', fontSize: 12 } }

export default function Analytics() {
  const [range, setRange] = useState('Last 7d')

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-20 max-w-7xl mx-auto px-6 pb-16">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link to="/builder" className="flex items-center gap-2 text-gami-muted hover:text-white transition-colors font-mono text-sm mb-3">
              <ArrowLeft size={14} /> Back to Builder
            </Link>
            <h1 className="font-display font-bold text-3xl text-white">Analytics</h1>
            <p className="text-gami-muted font-sans mt-1">Real-time performance metrics for your campaigns.</p>
          </div>
          <div className="flex items-center gap-3">
            {RANGE_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-mono border transition-all ${
                  range === r ? 'bg-gami-purple border-gami-purple text-white' : 'border-gami-border text-gami-muted hover:border-gami-purple hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
            <button className="flex items-center gap-1.5 border border-gami-border text-gami-muted px-3 py-1.5 text-xs font-mono hover:border-gami-purple hover:text-white transition-colors">
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total DAU', value: '62,100', delta: '+8.2%', positive: true },
            { label: 'XP Distributed', value: '2.4M', delta: '+15.4%', positive: true },
            { label: 'Quest Completions', value: '7,800', delta: '+3.1%', positive: true },
            { label: 'Churn Rate', value: '4.2%', delta: '-0.8%', positive: true },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-gami-surface border border-gami-border shadow-brutal p-4">
              <div className="font-mono text-gami-muted text-xs uppercase tracking-widest mb-2">{kpi.label}</div>
              <div className="font-display font-bold text-white text-2xl">{kpi.value}</div>
              <div className={`font-mono text-xs mt-1 ${kpi.positive ? 'text-gami-green' : 'text-gami-red'}`}>{kpi.delta} vs prev period</div>
            </div>
          ))}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* DAU Line */}
          <div className="bg-gami-surface border border-gami-border shadow-brutal p-5">
            <h3 className="font-display font-semibold text-white mb-4">Daily Active Users</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={MOCK_DAU_DATA} {...chartTooltipStyle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Line type="monotone" dataKey="dau" stroke="#6E3CFB" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#6E3CFB', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* XP Distribution */}
          <div className="bg-gami-surface border border-gami-border shadow-brutal p-5">
            <h3 className="font-display font-semibold text-white mb-4">XP Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={XP_HISTOGRAM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="users" fill="#00F5A0" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quest Funnel */}
          <div className="bg-gami-surface border border-gami-border shadow-brutal p-5">
            <h3 className="font-display font-semibold text-white mb-4">Quest Completion Funnel</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={FUNNEL} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="stage" type="category" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={80} />
                <Tooltip {...chartTooltipStyle} />
                <Bar dataKey="value" fill="#9C6CFF" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Quests */}
          <div className="bg-gami-surface border border-gami-border shadow-brutal p-5">
            <h3 className="font-display font-semibold text-white mb-4">Top Quests by Completion Rate</h3>
            <div className="space-y-3">
              {TOP_QUESTS.map((q) => (
                <div key={q.name} className="flex items-center gap-3">
                  <div className="font-mono text-xs text-gami-muted w-28 truncate">{q.name}</div>
                  <div className="flex-1 bg-gami-bg h-3 border border-gami-border">
                    <div className="h-full bg-gami-purple transition-all" style={{ width: `${q.rate}%` }} />
                  </div>
                  <div className="font-mono text-xs text-gami-green w-8 text-right">{q.rate}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Retention Heatmap */}
          <div className="bg-gami-surface border border-gami-border shadow-brutal p-5">
            <h3 className="font-display font-semibold text-white mb-4">Activity Heatmap (by Hour)</h3>
            <RetentionHeatmap seed={99} />
          </div>

          {/* Token Spend Area */}
          <div className="bg-gami-surface border border-gami-border shadow-brutal p-5">
            <h3 className="font-display font-semibold text-white mb-4">GAMI Reward Spend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={TOKEN_SPEND}>
                <defs>
                  <linearGradient id="gamiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F5C518" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F5C518" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6B7280', fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTooltipStyle} />
                <Area type="monotone" dataKey="gami" stroke="#F5C518" strokeWidth={2} fill="url(#gamiGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
