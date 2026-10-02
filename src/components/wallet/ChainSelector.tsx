const CHAINS = ['All Chains', 'Base', 'Polygon', 'Arbitrum', 'Solana']

interface ChainSelectorProps {
  value: string
  onChange: (chain: string) => void
}

export default function ChainSelector({ value, onChange }: ChainSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gami-bg border border-gami-border text-white font-mono text-xs px-3 py-2 focus:border-gami-purple outline-none cursor-pointer"
    >
      {CHAINS.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  )
}
