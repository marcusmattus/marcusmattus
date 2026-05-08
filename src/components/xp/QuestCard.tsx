import { Clock, Zap, ChevronRight } from 'lucide-react'

interface QuestCardProps {
  title: string
  description: string
  progress: number
  xpReward: number
  timeRemaining: string
  category: string
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Epic'
}

const difficultyColors: Record<string, string> = {
  Easy: 'text-gami-green border-gami-green',
  Medium: 'text-gami-yellow border-gami-yellow',
  Hard: 'text-gami-red border-gami-red',
  Epic: 'text-gami-accent border-gami-accent',
}

export default function QuestCard({
  title,
  description,
  progress,
  xpReward,
  timeRemaining,
  category,
  difficulty,
}: QuestCardProps) {
  return (
    <div className="brutal-card p-5 min-w-[280px] cursor-pointer group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">
            {category}
          </span>
          <h3 className="font-display font-semibold text-white mt-1 text-sm">{title}</h3>
        </div>
        <span
          className={`text-xs font-mono border px-2 py-0.5 ${difficultyColors[difficulty]}`}
        >
          {difficulty}
        </span>
      </div>

      <p className="text-gami-muted text-xs font-body leading-relaxed mb-4">{description}</p>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <span className="text-xs font-mono text-gami-muted">Progress</span>
          <span className="text-xs font-mono text-gami-green">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-gami-bg border border-gami-border overflow-hidden">
          <div
            className="h-full bg-gami-green transition-all duration-1000"
            style={{
              width: `${progress}%`,
              boxShadow: '0 0 8px rgba(0, 245, 160, 0.5)',
            }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gami-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Zap size={12} className="text-gami-yellow" fill="currentColor" />
            <span className="text-xs font-mono text-gami-yellow">+{xpReward} XP</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={12} className="text-gami-muted" />
            <span className="text-xs font-mono text-gami-muted">{timeRemaining}</span>
          </div>
        </div>
        <ChevronRight
          size={14}
          className="text-gami-muted group-hover:text-gami-purple transition-colors"
        />
      </div>
    </div>
  )
}
