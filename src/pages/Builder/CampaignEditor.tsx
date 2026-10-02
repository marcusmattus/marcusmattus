import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Save, X, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import Navbar from '../../components/layout/Navbar'
import { MOCK_CAMPAIGNS } from '../../lib/mockData'

interface FormData {
  name: string
  description: string
  startDate: string
  endDate: string
  budget: string
  xpPerEvent: string
  tokenPerEvent: string
  maxPerUser: string
}

export default function CampaignEditor() {
  const { id } = useParams<{ id: string }>()
  const campaign = MOCK_CAMPAIGNS.find((c) => c.id === id)

  const [form, setForm] = useState<FormData>({
    name: campaign?.name ?? '',
    description: 'Reward users for completing key onboarding actions and first purchases.',
    startDate: campaign?.start ?? '2026-06-01',
    endDate: '2026-08-31',
    budget: '5000',
    xpPerEvent: '250',
    tokenPerEvent: '25',
    maxPerUser: '3',
  })
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<Partial<FormData>>({})

  const validate = (): boolean => {
    const e: Partial<FormData> = {}
    if (!form.name.trim()) e.name = 'Campaign name is required'
    if (!form.startDate) e.startDate = 'Start date is required'
    if (Number(form.budget) < 100) e.budget = 'Budget must be at least $100'
    if (Number(form.xpPerEvent) < 1) e.xpPerEvent = 'XP must be at least 1'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const field = (key: keyof FormData, label: string, type = 'text', hint?: string) => (
    <div>
      <label className="block font-mono text-xs text-gami-muted uppercase tracking-widest mb-1.5">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className={`w-full bg-gami-bg border text-white px-4 py-2.5 font-mono text-sm focus:border-gami-purple outline-none ${
          errors[key] ? 'border-gami-red' : 'border-gami-border'
        }`}
      />
      {errors[key] && <p className="font-mono text-xs text-gami-red mt-1">{errors[key]}</p>}
      {hint && <p className="font-mono text-xs text-gami-muted mt-1">{hint}</p>}
    </div>
  )

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-20 max-w-3xl mx-auto px-6 pb-16">
        {/* Header */}
        <div className="mb-8">
          <Link to="/builder" className="flex items-center gap-2 text-gami-muted hover:text-white transition-colors font-mono text-sm mb-4">
            <ArrowLeft size={14} /> Back to Builder
          </Link>
          <div className="flex items-center justify-between">
            <h1 className="font-display font-bold text-3xl text-white">
              {campaign ? `Edit: ${campaign.name}` : 'New Campaign'}
            </h1>
            {campaign && (
              <span className={`font-mono text-xs px-2 py-1 border uppercase tracking-widest ${
                campaign.status === 'active' ? 'text-gami-green border-gami-green' : 'text-gami-muted border-gami-border'
              }`}>
                {campaign.status}
              </span>
            )}
          </div>
        </div>

        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-gami-green/10 border border-gami-green px-4 py-3 flex items-center gap-2"
          >
            <Save size={14} className="text-gami-green" />
            <span className="font-mono text-sm text-gami-green">Campaign saved successfully.</span>
          </motion.div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="mb-6 bg-gami-red/10 border border-gami-red px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-gami-red mt-0.5 flex-shrink-0" />
            <span className="font-mono text-sm text-gami-red">Please fix the errors below before saving.</span>
          </div>
        )}

        <div className="bg-gami-surface border border-gami-border shadow-brutal p-6 space-y-6">
          {/* Basic info */}
          <div>
            <h2 className="font-display font-semibold text-white mb-4">Campaign Details</h2>
            <div className="space-y-4">
              {field('name', 'Campaign Name')}
              <div>
                <label className="block font-mono text-xs text-gami-muted uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-gami-bg border border-gami-border text-white px-4 py-2.5 font-mono text-sm focus:border-gami-purple outline-none resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field('startDate', 'Start Date', 'date')}
                {field('endDate', 'End Date', 'date')}
              </div>
            </div>
          </div>

          {/* Rewards */}
          <div className="border-t border-gami-border pt-6">
            <h2 className="font-display font-semibold text-white mb-4">Reward Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              {field('budget', 'Total Budget (GAMI)', 'number', 'Maximum GAMI tokens allocated for this campaign')}
              {field('xpPerEvent', 'XP per Event', 'number')}
              {field('tokenPerEvent', 'GAMI per Event', 'number')}
              {field('maxPerUser', 'Max Claims per User', 'number')}
            </div>
          </div>

          {/* Estimated reach */}
          <div className="border-t border-gami-border pt-6">
            <h2 className="font-display font-semibold text-white mb-3">Estimated Reach</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Max Participants', value: Math.floor(Number(form.budget) / Number(form.tokenPerEvent) / Number(form.maxPerUser) || 0).toLocaleString() },
                { label: 'Total XP Pool', value: (Number(form.budget) / Number(form.tokenPerEvent) * Number(form.xpPerEvent) || 0).toLocaleString() },
                { label: 'Est. Duration', value: `${Math.ceil((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / (1000 * 60 * 60 * 24)) || 0}d` },
              ].map((s) => (
                <div key={s.label} className="bg-gami-bg border border-gami-border p-3">
                  <div className="font-mono text-gami-green text-lg font-bold">{s.value}</div>
                  <div className="font-sans text-gami-muted text-xs">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-gami-purple text-white font-display font-semibold px-6 py-3 shadow-brutal hover:shadow-brutal-purple transition-all"
          >
            <Save size={16} /> Save Campaign
          </button>
          <Link
            to="/builder"
            className="flex items-center gap-2 border border-gami-border text-gami-muted px-6 py-3 hover:border-gami-purple hover:text-white transition-all font-mono text-sm"
          >
            <X size={16} /> Cancel
          </Link>
        </div>
      </div>
    </div>
  )
}
