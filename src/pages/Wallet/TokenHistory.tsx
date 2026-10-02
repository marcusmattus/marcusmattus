import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'
import TransactionRow from '../../components/wallet/TransactionRow'
import ChainSelector from '../../components/wallet/ChainSelector'
import { MOCK_TRANSACTIONS } from '../../lib/mockData'

type TypeFilter = 'all' | 'earn' | 'spend' | 'bridge'

export default function TokenHistory() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [chain, setChain] = useState('All Chains')

  const filtered = MOCK_TRANSACTIONS.filter((tx) => {
    const matchType = typeFilter === 'all' || tx.type === typeFilter
    const matchChain = chain === 'All Chains' || tx.chain.includes(chain)
    return matchType && matchChain
  })

  const exportCSV = () => {
    const headers = ['Date', 'Type', 'App', 'Amount', 'Token', 'Chain', 'Status', 'Hash']
    const rows = filtered.map((tx) => [tx.date, tx.type, tx.app, tx.amount, tx.tokenAmount, tx.chain, tx.status, tx.hash])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'gami-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-20 max-w-6xl mx-auto px-6 pb-16">
        {/* Header */}
        <div className="mb-6">
          <Link to="/wallet" className="flex items-center gap-2 text-gami-muted hover:text-white transition-colors font-mono text-sm mb-4">
            <ArrowLeft size={14} /> Back to Wallet
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="font-display font-bold text-3xl text-white">Transaction History</h1>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 border border-gami-border text-gami-muted px-4 py-2 hover:border-gami-purple hover:text-white transition-colors font-mono text-sm"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-2">
            {(['all', 'earn', 'spend', 'bridge'] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-mono border transition-all uppercase tracking-widest ${
                  typeFilter === t
                    ? 'bg-gami-purple border-gami-purple text-white'
                    : 'border-gami-border text-gami-muted hover:border-gami-purple hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <ChainSelector value={chain} onChange={setChain} />
        </div>

        {/* Table */}
        <div className="bg-gami-surface border border-gami-border shadow-brutal overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-mono text-gami-muted text-sm">No transactions match your filters.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gami-border">
                  {['Date', 'Type', 'App', 'Amount', 'Token Amount', 'Chain', 'Status', 'Hash'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-mono text-xs text-gami-muted uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <TransactionRow key={tx.id} {...tx} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="font-mono text-xs text-gami-muted mt-4">
          Showing {filtered.length} of {MOCK_TRANSACTIONS.length} transactions
        </p>
      </div>
    </div>
  )
}
