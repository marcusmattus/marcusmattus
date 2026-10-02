import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DataPoint {
  day: string
  xp: number
}

interface XPVelocityChartProps {
  data: DataPoint[]
  height?: number
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gami-surface border border-gami-border px-3 py-2">
      <p className="font-mono text-xs text-gami-muted">{label}</p>
      <p className="font-mono text-sm text-gami-green">+{payload[0].value.toLocaleString()} XP</p>
    </div>
  )
}

export default function XPVelocityChart({ data, height = 160 }: XPVelocityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#6B7280', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="xp"
          stroke="#00F5A0"
          strokeWidth={2}
          dot={{ fill: '#00F5A0', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#00F5A0', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
