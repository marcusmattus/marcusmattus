interface StreakBadgeProps {
  streak: number
  size?: 'sm' | 'md' | 'lg'
}

export default function StreakBadge({ streak, size = 'md' }: StreakBadgeProps) {
  const sizes = {
    sm: { container: 'px-2 py-1', icon: 'text-sm', text: 'text-xs' },
    md: { container: 'px-3 py-1.5', icon: 'text-base', text: 'text-sm' },
    lg: { container: 'px-4 py-2', icon: 'text-xl', text: 'text-base' },
  }

  const s = sizes[size]

  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-gami-surface border border-gami-border ${s.container}`}
      style={{ boxShadow: '4px 4px 0px 0px #000' }}
    >
      <span className={s.icon}>🔥</span>
      <span className={`font-mono font-bold text-gami-yellow ${s.text}`}>{streak}</span>
      <span className={`font-mono text-gami-muted ${s.text}`}>day streak</span>
    </div>
  )
}
