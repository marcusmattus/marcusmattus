import { Link } from 'react-router-dom'
import { ArrowLeft, Flame, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import Navbar from '../../components/layout/Navbar'
import { MOCK_LEADERBOARD } from '../../lib/mockData'

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export default function Leaderboard() {
  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-20 max-w-3xl mx-auto px-6 pb-16">
        {/* Header */}
        <div className="mb-8">
          <Link to="/dashboard" className="flex items-center gap-2 text-gami-muted hover:text-white transition-colors font-mono text-sm mb-4">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <Trophy size={28} className="text-gami-yellow" />
            <h1 className="font-display font-bold text-3xl text-white">Global Leaderboard</h1>
          </div>
          <p className="text-gami-muted font-sans mt-2">Weekly XP rankings across all connected apps.</p>
        </div>

        {/* Top 3 podium */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {MOCK_LEADERBOARD.slice(0, 3).map((entry, i) => (
            <motion.div
              key={entry.rank}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`bg-gami-surface border p-4 text-center shadow-brutal ${
                i === 0 ? 'border-gami-yellow' : 'border-gami-border'
              }`}
            >
              <div className="text-3xl mb-2">{MEDAL[entry.rank]}</div>
              <div className="text-2xl mb-1">{entry.avatar}</div>
              <div className="font-display font-semibold text-white text-sm">{entry.username}</div>
              <div className="font-mono text-gami-green text-sm mt-1">{entry.xp.toLocaleString()} XP</div>
              <div className="font-sans text-gami-muted text-xs mt-1">LVL {entry.level}</div>
              {entry.streak > 0 && (
                <div className="flex items-center justify-center gap-1 mt-2">
                  <Flame size={10} className="text-gami-yellow" />
                  <span className="font-mono text-gami-yellow text-xs">{entry.streak}d</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Full table */}
        <div className="bg-gami-surface border border-gami-border shadow-brutal">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gami-border">
                {['Rank', 'Player', 'Level', 'XP', 'Streak'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-mono text-xs text-gami-muted uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_LEADERBOARD.map((entry, i) => {
                const isCurrentUser = entry.isCurrentUser
                const hasSeparator = i > 0 && entry.rank > MOCK_LEADERBOARD[i - 1].rank + 1

                return (
                  <>
                    {hasSeparator && (
                      <tr key={`sep-${entry.rank}`}>
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 border-t border-dashed border-gami-border" />
                            <span className="font-mono text-xs text-gami-muted">···</span>
                            <div className="flex-1 border-t border-dashed border-gami-border" />
                          </div>
                        </td>
                      </tr>
                    )}
                    <motion.tr
                      key={entry.rank}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`border-b border-gami-border transition-colors ${
                        isCurrentUser
                          ? 'bg-gami-purple/20 border-gami-purple/30'
                          : 'hover:bg-gami-bg/50'
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-sm text-gami-muted">
                        {MEDAL[entry.rank] ?? `#${entry.rank.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{entry.avatar}</span>
                          <span className={`font-display font-semibold text-sm ${isCurrentUser ? 'text-gami-green' : 'text-white'}`}>
                            {entry.username} {isCurrentUser && <span className="text-gami-muted font-mono text-xs">(you)</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gami-accent">LVL {entry.level}</td>
                      <td className="px-4 py-3 font-mono text-sm text-gami-green">{entry.xp.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Flame size={12} className="text-gami-yellow" />
                          <span className="font-mono text-xs text-gami-yellow">{entry.streak}d</span>
                        </div>
                      </td>
                    </motion.tr>
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
