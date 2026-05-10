import { Clock, Zap, CheckCircle, ChevronRight } from 'lucide-react'

export interface Quest {
  id: string
  name: string
  description: string
  app: string
  appColor: string
  xpReward: number
  progress: number
  status: 'available' | 'in_progress' | 'completed' | 'expired'
  expiresAt: string | null
}

interface QuestCardProps {
  quest: Quest
  compact?: boolean
}

const STATUS_LABEL: Record<Quest['status'], string> = {
  available:   'AVAILABLE',
  in_progress: 'IN PROGRESS',
  completed:   'COMPLETED',
  expired:     'EXPIRED',
}

const STATUS_STYLE: Record<Quest['status'], string> = {
  available:   'text-gami-muted border-gami-muted',
  in_progress: 'text-gami-yellow border-gami-yellow',
  completed:   'text-gami-green border-gami-green',
  expired:     'text-gami-red border-gami-red',
}

function daysRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  return `${days}d left`
}

export default function QuestCard({ quest, compact = false }: QuestCardProps) {
  const timeLeft = daysRemaining(quest.expiresAt)
  const isComplete = quest.status === 'completed'

  return (
    <div className="bg-gami-surface border border-gami-border shadow-brutal hover:shadow-brutal-purple hover:-translate-y-1 transition-all p-5 group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* App color dot */}
          <span
            className="w-2 h-2 flex-shrink-0"
            style={{ background: quest.appColor }}
          />
          <span className="font-mono text-xs text-gami-muted uppercase tracking-widest">{quest.app}</span>
        </div>
        <span className={`font-mono text-xs px-1.5 py-0.5 border ${STATUS_STYLE[quest.status]}`}>
          {STATUS_LABEL[quest.status]}
        </span>
      </div>

      {/* Quest name */}
      <h3 className="font-display font-semibold text-white text-lg mb-1 leading-tight">{quest.name}</h3>
      {!compact && (
        <p className="font-sans text-gami-muted text-sm mb-4 leading-relaxed">{quest.description}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-1.5">
          <span className="font-mono text-xs text-gami-muted">{quest.progress}% complete</span>
          {timeLeft && (
            <div className="flex items-center gap-1 font-mono text-xs text-gami-yellow">
              <Clock size={10} />
              {timeLeft}
            </div>
          )}
        </div>
        <div className="w-full h-2 bg-gami-bg border border-gami-border overflow-hidden">
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${quest.progress}%`,
              background: isComplete ? '#00F5A0' : quest.appColor,
              boxShadow: `0 0 8px ${isComplete ? '#00F5A080' : quest.appColor + '60'}`,
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-gami-green" />
          <span className="font-mono text-gami-green font-bold text-sm">+{quest.xpReward.toLocaleString()} XP</span>
        </div>
        {isComplete ? (
          <div className="flex items-center gap-1 text-gami-green font-mono text-xs">
            <CheckCircle size={12} />
            Done
          </div>
        ) : (
          <button className="flex items-center gap-1 text-xs font-mono text-gami-accent hover:text-white transition-colors group-hover:text-white">
            {quest.status === 'available' ? 'Start' : 'Continue'}
            <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  )
}
