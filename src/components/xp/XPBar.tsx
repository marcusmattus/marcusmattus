import { useEffect, useRef, useState } from 'react'

interface XPBarProps {
  current: number
  max: number
  level: number
  showLabel?: boolean
  height?: number
}

export default function XPBar({ current, max, level, showLabel = true, height = 8 }: XPBarProps) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const percent = Math.min((current / max) * 100, 100)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setAnimated(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-mono text-gami-muted">
            LVL <span className="text-gami-green">{level}</span>
          </span>
          <span className="text-xs font-mono text-gami-muted">
            <span className="text-gami-green">{current.toLocaleString()}</span>
            {' / '}
            {max.toLocaleString()} XP
          </span>
        </div>
      )}
      <div
        className="w-full bg-gami-bg border border-gami-border overflow-hidden"
        style={{ height }}
      >
        <div
          className="h-full bg-gami-green transition-all duration-1000 ease-out"
          style={{
            width: animated ? `${percent}%` : '0%',
            boxShadow: '0 0 12px rgba(0, 245, 160, 0.6)',
          }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-right">
          <span className="text-xs font-mono text-gami-muted">{percent.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}
