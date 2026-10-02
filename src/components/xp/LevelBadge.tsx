interface LevelBadgeProps {
  level: number
  size?: 'sm' | 'md' | 'lg'
}

export default function LevelBadge({ level, size = 'md' }: LevelBadgeProps) {
  const sizes = {
    sm: 'text-sm px-2 py-0.5',
    md: 'text-base px-3 py-1',
    lg: 'text-2xl px-4 py-2',
  }

  return (
    <span
      className={`font-display font-bold bg-gami-purple text-white ${sizes[size]} shadow-brutal-sm inline-block`}
    >
      LVL {level}
    </span>
  )
}
