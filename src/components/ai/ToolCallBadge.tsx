import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'

const TOOL_ICONS: Record<string, string> = {
  get_user_xp: '⚡',
  get_active_quests: '🎯',
  grant_xp: '✨',
  redeem_reward: '🎁',
  get_balance: '💰',
  get_leaderboard: '🏆',
  flag_suspicious_activity: '🚩',
}

interface ToolCallBadgeProps {
  name: string
  result?: string
}

export default function ToolCallBadge({ name, result }: ToolCallBadgeProps) {
  const [glowing, setGlowing] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setGlowing(false), 1200)
    return () => clearTimeout(t)
  }, [])

  const icon = TOOL_ICONS[name] ?? '🔧'
  const label = name.replace(/_/g, ' ')

  let preview = ''
  if (result) {
    try {
      const parsed = JSON.parse(result)
      preview = JSON.stringify(parsed).slice(0, 60)
      if (preview.length === 60) preview += '…'
    } catch {
      preview = result.slice(0, 60)
    }
  }

  return (
    <div
      className={`inline-flex flex-col gap-1 border p-2 text-xs font-mono transition-shadow ${
        glowing ? 'border-gami-purple shadow-glow' : 'border-gami-border'
      }`}
    >
      <div className="flex items-center gap-1.5 text-gami-accent">
        <Zap size={10} className="text-gami-yellow" />
        <span>{icon} {label}</span>
      </div>
      {preview && (
        <span className="text-gami-muted text-[10px] leading-tight break-all">{preview}</span>
      )}
    </div>
  )
}
