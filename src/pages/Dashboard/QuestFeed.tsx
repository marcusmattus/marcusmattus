import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import Navbar from '../../components/layout/Navbar'
import QuestCard from '../../components/xp/QuestCard'
import { MOCK_QUESTS } from '../../lib/mockData'

type Filter = 'all' | 'in_progress' | 'available' | 'completed'

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Available', value: 'available' },
  { label: 'Completed', value: 'completed' },
]

export default function QuestFeed() {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const filtered = MOCK_QUESTS.filter((q) => {
    const matchesFilter = filter === 'all' || q.status === filter
    const matchesSearch = q.name.toLowerCase().includes(search.toLowerCase()) || q.app.toLowerCase().includes(search.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-20 max-w-4xl mx-auto px-6 pb-16">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="flex items-center gap-2 text-gami-muted hover:text-white transition-colors font-mono text-sm mb-4">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <h1 className="font-display font-bold text-3xl text-white mb-2">Quest Feed</h1>
          <p className="text-gami-muted font-sans">Complete quests to earn XP and token rewards across every connected app.</p>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gami-muted" />
            <input
              type="text"
              placeholder="Search quests or apps…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gami-bg border border-gami-border text-white pl-9 pr-4 py-2.5 font-mono text-sm focus:border-gami-purple outline-none"
            />
          </div>
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-2 text-xs font-mono border transition-all ${
                  filter === f.value
                    ? 'bg-gami-purple border-gami-purple text-white'
                    : 'border-gami-border text-gami-muted hover:border-gami-purple hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quest grid */}
        {filtered.length === 0 ? (
          <div className="bg-gami-surface border border-gami-border p-12 text-center">
            <p className="font-mono text-gami-muted text-sm">No quests found.</p>
            <button onClick={() => { setFilter('all'); setSearch('') }} className="mt-4 text-gami-accent font-mono text-sm hover:text-white transition-colors">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map((quest, i) => (
              <motion.div
                key={quest.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <QuestCard quest={quest} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats bar */}
        <div className="mt-8 bg-gami-surface border border-gami-border p-4 flex gap-6">
          {[
            { label: 'Total Quests', value: MOCK_QUESTS.length },
            { label: 'In Progress', value: MOCK_QUESTS.filter(q => q.status === 'in_progress').length },
            { label: 'Completed', value: MOCK_QUESTS.filter(q => q.status === 'completed').length },
            { label: 'Available', value: MOCK_QUESTS.filter(q => q.status === 'available').length },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-mono text-gami-green text-xl font-bold">{s.value}</div>
              <div className="font-sans text-gami-muted text-xs">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
