import { ExternalLink } from 'lucide-react'

interface TransactionRowProps {
  date: string
  type: 'earn' | 'spend' | 'bridge'
  app: string
  amount: string
  tokenAmount: string
  chain: string
  status: 'pending' | 'confirmed' | 'failed'
  hash: string
}

const TYPE_STYLES: Record<string, string> = {
  earn:   'bg-gami-green/10 text-gami-green border-gami-green/30',
  spend:  'bg-gami-red/10 text-gami-red border-gami-red/30',
  bridge: 'bg-gami-accent/10 text-gami-accent border-gami-accent/30',
}

const STATUS_DOT: Record<string, string> = {
  confirmed: 'bg-gami-green',
  pending:   'bg-gami-yellow animate-pulse',
  failed:    'bg-gami-red',
}

export default function TransactionRow({ date, type, app, amount, tokenAmount, chain, status, hash }: TransactionRowProps) {
  return (
    <tr className="border-b border-gami-border hover:bg-gami-surface/50 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-gami-muted whitespace-nowrap">{date}</td>
      <td className="px-4 py-3">
        <span className={`font-mono text-xs px-2 py-0.5 border uppercase tracking-widest ${TYPE_STYLES[type]}`}>
          {type}
        </span>
      </td>
      <td className="px-4 py-3 font-sans text-sm text-white">{app}</td>
      <td className={`px-4 py-3 font-mono text-sm ${type === 'earn' ? 'text-gami-green' : type === 'spend' ? 'text-gami-red' : 'text-gami-accent'}`}>
        {amount}
      </td>
      <td className="px-4 py-3 font-mono text-sm text-gami-muted">{tokenAmount}</td>
      <td className="px-4 py-3 font-mono text-xs text-gami-muted">{chain}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 ${STATUS_DOT[status]}`} />
          <span className="font-mono text-xs text-gami-muted capitalize">{status}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <a
          href={`https://basescan.org/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-xs text-gami-accent hover:text-white transition-colors"
        >
          {hash.slice(0, 10)}…
          <ExternalLink size={10} />
        </a>
      </td>
    </tr>
  )
}
