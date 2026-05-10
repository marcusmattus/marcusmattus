import { useMemo } from 'react'

const HOURS = ['12am', '6am', '12pm', '6pm']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Stable seeded pseudo-random so values never change between renders
function seededRandom(seed: number) {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

interface RetentionHeatmapProps {
  seed?: number
}

export default function RetentionHeatmap({ seed = 42 }: RetentionHeatmapProps) {
  const grid = useMemo(
    () =>
      HOURS.map((_, hi) =>
        DAYS.map((_, di) => seededRandom(seed + hi * 7 + di)),
      ),
    [seed],
  )

  const color = (v: number) => (v > 0.7 ? '#6E3CFB' : v > 0.4 ? '#4B24B8' : '#2A2A3A')

  return (
    <div>
      <div className="grid grid-cols-8 gap-1 mb-1">
        <div />
        {DAYS.map((d) => (
          <div key={d} className="text-center font-mono text-[10px] text-gami-muted">{d}</div>
        ))}
      </div>
      {HOURS.map((h, hi) => (
        <div key={h} className="grid grid-cols-8 gap-1 mb-1">
          <div className="font-mono text-[10px] text-gami-muted text-right pr-1 leading-4">{h}</div>
          {grid[hi].map((v, di) => (
            <div key={di} className="h-4 transition-colors" style={{ background: color(v) }} />
          ))}
        </div>
      ))}
      <div className="flex items-center gap-2 mt-2 justify-end">
        <span className="font-mono text-[10px] text-gami-muted">Less</span>
        {['#2A2A3A', '#4B24B8', '#6E3CFB', '#9C6CFF'].map((c) => (
          <div key={c} className="w-3 h-3" style={{ background: c }} />
        ))}
        <span className="font-mono text-[10px] text-gami-muted">More</span>
      </div>
    </div>
  )
}
