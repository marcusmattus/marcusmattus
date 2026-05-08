import { useState } from 'react'
import { Copy, Check, ChevronRight, ChevronDown, Play, ExternalLink } from 'lucide-react'
import Navbar from '../components/layout/Navbar'

type Lang = 'typescript' | 'python' | 'curl'

const navSections = [
  {
    title: 'Getting Started',
    items: ['Introduction', 'Installation', 'Quick Start', 'Authentication'],
  },
  {
    title: 'Core SDK',
    items: ['XP Engine', 'Quest Manager', 'Player Identity', 'Leaderboards'],
  },
  {
    title: 'Rewards',
    items: ['Token Distribution', 'NFT Rewards', 'Badges', 'Inventory'],
  },
  {
    title: 'AI Agent',
    items: ['Overview', 'Tool Definitions', 'Memory Context', 'Streaming'],
  },
  {
    title: 'Webhooks',
    items: ['Setup', 'Events', 'Security', 'Retry Logic'],
  },
  {
    title: 'Reference',
    items: ['API Reference', 'Error Codes', 'Rate Limits', 'Changelog'],
  },
]

const codeSnippets: Record<Lang, string> = {
  typescript: `import { GamiProtocol } from '@gami/sdk'

const gami = new GamiProtocol({
  appId: 'app_xyz123',
  apiKey: process.env.GAMI_API_KEY,
  network: 'mainnet', // or 'testnet'
})

// Award XP for a user action
const result = await gami.xp.award({
  userId: 'usr_abc123',
  action: 'purchase_completed',
  amount: 500,
  metadata: {
    orderId: 'ord_789',
    amount: 49.99,
    currency: 'USD',
  },
})

console.log(result)
// → { xp: 24850, level: 42, leveledUp: false, questsProgressed: ['q_1'] }

// Get active quests
const quests = await gami.quests.getActive('usr_abc123')
// → [{ id: 'q_1', title: 'First Purchase', progress: 0.6, xpReward: 500 }]

// Get player profile
const player = await gami.players.get('usr_abc123')
// → { level: 42, xp: 24850, rank: 4821, streak: 14 }`,

  python: `from gami_sdk import GamiProtocol
import os

gami = GamiProtocol(
    app_id="app_xyz123",
    api_key=os.environ["GAMI_API_KEY"],
    network="mainnet"
)

# Award XP for a user action
result = gami.xp.award(
    user_id="usr_abc123",
    action="purchase_completed",
    amount=500,
    metadata={
        "order_id": "ord_789",
        "amount": 49.99,
        "currency": "USD",
    }
)

print(result)
# → {"xp": 24850, "level": 42, "leveled_up": False, "quests_progressed": ["q_1"]}

# Get active quests
quests = gami.quests.get_active("usr_abc123")
# → [{"id": "q_1", "title": "First Purchase", "progress": 0.6, "xp_reward": 500}]

# Get player profile
player = gami.players.get("usr_abc123")
# → {"level": 42, "xp": 24850, "rank": 4821, "streak": 14}`,

  curl: `# Award XP
curl -X POST https://api.gami.xyz/v1/xp/award \\
  -H "Authorization: Bearer $GAMI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "X-App-ID: app_xyz123" \\
  -d '{
    "userId": "usr_abc123",
    "action": "purchase_completed",
    "amount": 500,
    "metadata": {
      "orderId": "ord_789",
      "amount": 49.99,
      "currency": "USD"
    }
  }'

# Response:
# {
#   "xp": 24850,
#   "level": 42,
#   "leveledUp": false,
#   "questsProgressed": ["q_1"]
# }

# Get active quests
curl https://api.gami.xyz/v1/quests/active/usr_abc123 \\
  -H "Authorization: Bearer $GAMI_API_KEY" \\
  -H "X-App-ID: app_xyz123"`,
}

const installSteps = [
  { step: '1', label: 'Install the SDK', code: 'npm install @gami/sdk' },
  { step: '2', label: 'Set environment variable', code: 'GAMI_API_KEY=your_key_here' },
  { step: '3', label: 'Initialize client', code: 'const gami = new GamiProtocol({ appId, apiKey })' },
]

const apiEndpoints = [
  { method: 'POST', path: '/v1/xp/award', desc: 'Award XP to a player', auth: true },
  { method: 'GET', path: '/v1/xp/:userId', desc: 'Get player XP balance', auth: true },
  { method: 'GET', path: '/v1/quests/active/:userId', desc: 'Get active quests', auth: true },
  { method: 'POST', path: '/v1/quests/complete', desc: 'Mark quest as completed', auth: true },
  { method: 'GET', path: '/v1/players/:userId', desc: 'Get full player profile', auth: true },
  { method: 'GET', path: '/v1/leaderboard', desc: 'Get global leaderboard', auth: false },
  { method: 'POST', path: '/v1/tokens/distribute', desc: 'Distribute $GAMI tokens', auth: true },
]

const methodColors: Record<string, string> = {
  GET: 'text-gami-green border-gami-green',
  POST: 'text-gami-yellow border-gami-yellow',
  PUT: 'text-gami-accent border-gami-accent',
  DELETE: 'text-gami-red border-gami-red',
}

export default function SDKDocs() {
  const [lang, setLang] = useState<Lang>('typescript')
  const [copied, setCopied] = useState(false)
  const [activeSection, setActiveSection] = useState('Quick Start')
  const [openSections, setOpenSections] = useState<string[]>(['Getting Started', 'Core SDK'])
  const [playgroundResponse, setPlaygroundResponse] = useState('')
  const [playgroundLoading, setPlaygroundLoading] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[lang])
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleSection = (section: string) => {
    setOpenSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    )
  }

  const runPlayground = () => {
    setPlaygroundLoading(true)
    setPlaygroundResponse('')
    setTimeout(() => {
      setPlaygroundLoading(false)
      setPlaygroundResponse(JSON.stringify({
        xp: 24850,
        level: 42,
        leveledUp: false,
        questsProgressed: ['q_1'],
        newXP: 25350,
        timestamp: new Date().toISOString(),
      }, null, 2))
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-16 flex min-h-screen">
        {/* Left Nav Tree */}
        <aside className="hidden lg:flex flex-col w-60 bg-gami-surface border-r border-gami-border fixed left-0 top-16 bottom-0 overflow-y-auto">
          <div className="p-4 border-b border-gami-border">
            <div className="text-xs font-mono text-gami-muted uppercase tracking-widest mb-2">SDK Version</div>
            <div className="font-mono text-gami-green text-sm">v2.4.1 (latest)</div>
          </div>
          <nav className="flex-1 p-3">
            {navSections.map((section) => (
              <div key={section.title} className="mb-1">
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-mono text-gami-muted uppercase tracking-widest hover:text-white transition-colors"
                >
                  {section.title}
                  {openSections.includes(section.title)
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />}
                </button>
                {openSections.includes(section.title) && (
                  <div className="ml-2 border-l border-gami-border pl-2">
                    {section.items.map((item) => (
                      <button
                        key={item}
                        onClick={() => setActiveSection(item)}
                        className={`w-full text-left px-3 py-1.5 text-sm font-body transition-colors ${
                          activeSection === item
                            ? 'text-gami-purple font-medium'
                            : 'text-gami-muted hover:text-white'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-60 lg:mr-80 p-6 lg:p-10 max-w-4xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-mono text-gami-muted mb-8">
            <span>Docs</span>
            <ChevronRight size={12} />
            <span>Getting Started</span>
            <ChevronRight size={12} />
            <span className="text-gami-purple">{activeSection}</span>
          </div>

          <h1 className="font-display font-bold text-3xl text-white mb-2">{activeSection}</h1>
          <p className="text-gami-muted font-body text-lg mb-8 leading-relaxed">
            Add gamification to any app with five lines of code. The Gami SDK handles XP calculation,
            quest management, leaderboards, and on-chain rewards automatically.
          </p>

          {/* Installation Steps */}
          <section className="mb-10">
            <h2 className="font-display font-semibold text-xl text-white mb-5">Installation</h2>
            <div className="space-y-4">
              {installSteps.map((s) => (
                <div key={s.step} className="flex gap-4 items-start">
                  <div className="w-7 h-7 bg-gami-purple flex items-center justify-center text-white font-mono text-xs font-bold flex-shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-body text-gami-muted mb-1.5">{s.label}</div>
                    <div className="bg-gami-bg border border-gami-border px-4 py-2.5">
                      <code className="text-gami-green font-mono text-sm">{s.code}</code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Language Tabs + Code Block */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-0">
              <h2 className="font-display font-semibold text-xl text-white">SDK Quick Start</h2>
            </div>
            <div className="mt-5 bg-gami-surface border border-gami-border shadow-brutal">
              <div className="flex items-center justify-between border-b border-gami-border">
                <div className="flex">
                  {(['typescript', 'python', 'curl'] as Lang[]).map((l) => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-5 py-3 text-sm font-mono transition-colors ${
                        lang === l
                          ? 'bg-gami-purple text-white'
                          : 'text-gami-muted hover:text-white'
                      }`}
                    >
                      {l === 'typescript' ? 'TypeScript' : l === 'python' ? 'Python' : 'cURL'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-mono text-gami-muted hover:text-white transition-colors px-4 py-3 border-l border-gami-border"
                >
                  {copied ? <Check size={12} className="text-gami-green" /> : <Copy size={12} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="p-6 overflow-x-auto">
                <pre className="text-sm font-mono text-gami-green leading-relaxed">
                  {codeSnippets[lang].split('\n').map((line, i) => {
                    const isComment = line.trim().startsWith('#') || line.trim().startsWith('//')
                    const isKeyword = /^(import|from|const|let|var|async|await|print|curl)\b/.test(line.trim())
                    return (
                      <div key={i} className={isComment ? 'text-gami-muted' : isKeyword ? 'text-gami-accent' : 'text-gami-green'}>
                        {line || ' '}
                      </div>
                    )
                  })}
                </pre>
              </div>
            </div>
          </section>

          {/* API Endpoints Reference */}
          <section className="mb-10">
            <h2 className="font-display font-semibold text-xl text-white mb-5">API Reference</h2>
            <div className="bg-gami-surface border border-gami-border shadow-brutal">
              <div className="grid grid-cols-12 px-5 py-3 border-b border-gami-border text-xs font-mono text-gami-muted uppercase tracking-widest">
                <span className="col-span-2">Method</span>
                <span className="col-span-5">Endpoint</span>
                <span className="col-span-4">Description</span>
                <span className="col-span-1">Auth</span>
              </div>
              {apiEndpoints.map((ep) => (
                <div
                  key={ep.path}
                  className="grid grid-cols-12 px-5 py-3.5 border-b border-gami-border hover:bg-gami-bg transition-colors items-center"
                >
                  <div className="col-span-2">
                    <span className={`text-xs font-mono border px-1.5 py-0.5 ${methodColors[ep.method]}`}>
                      {ep.method}
                    </span>
                  </div>
                  <div className="col-span-5 font-mono text-gami-accent text-sm">{ep.path}</div>
                  <div className="col-span-4 text-sm font-body text-gami-muted">{ep.desc}</div>
                  <div className="col-span-1 text-xs font-mono text-center">
                    {ep.auth ? (
                      <span className="text-gami-yellow">🔑</span>
                    ) : (
                      <span className="text-gami-muted">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Error Codes */}
          <section>
            <h2 className="font-display font-semibold text-xl text-white mb-5">Error Codes</h2>
            <div className="space-y-2">
              {[
                { code: '400', name: 'INVALID_ACTION', desc: 'The action type is not registered in your app config.' },
                { code: '401', name: 'UNAUTHORIZED', desc: 'Invalid or missing API key.' },
                { code: '403', name: 'QUOTA_EXCEEDED', desc: 'Monthly XP event quota exceeded. Upgrade your plan.' },
                { code: '404', name: 'USER_NOT_FOUND', desc: 'The specified userId does not exist.' },
                { code: '429', name: 'RATE_LIMITED', desc: 'Too many requests. Max 1000 req/min per app.' },
              ].map((err) => (
                <div key={err.code} className="flex gap-4 items-start bg-gami-surface border border-gami-border px-4 py-3">
                  <span className="font-mono text-gami-red text-sm font-bold w-10 flex-shrink-0">{err.code}</span>
                  <span className="font-mono text-gami-yellow text-sm w-40 flex-shrink-0">{err.name}</span>
                  <span className="text-sm font-body text-gami-muted">{err.desc}</span>
                </div>
              ))}
            </div>
          </section>
        </main>

        {/* Right API Playground Panel */}
        <aside className="hidden lg:flex flex-col w-80 bg-gami-surface border-l border-gami-border fixed right-0 top-16 bottom-0 overflow-y-auto p-5 gap-5">
          <div>
            <h3 className="font-display font-semibold text-white mb-1">API Playground</h3>
            <p className="text-xs font-body text-gami-muted">Try API calls live against the testnet.</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-1.5">Endpoint</label>
              <select className="w-full bg-gami-bg border border-gami-border px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-gami-purple">
                <option>POST /v1/xp/award</option>
                <option>GET /v1/quests/active/:userId</option>
                <option>GET /v1/players/:userId</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-1.5">Request Body</label>
              <textarea
                className="w-full bg-gami-bg border border-gami-border p-3 text-gami-green font-mono text-xs focus:outline-none focus:border-gami-purple resize-none"
                rows={7}
                defaultValue={JSON.stringify({ userId: 'usr_abc123', action: 'purchase_completed', amount: 500 }, null, 2)}
              />
            </div>

            <div>
              <label className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-1.5">API Key</label>
              <input
                type="password"
                defaultValue="gami_test_••••••••"
                className="w-full bg-gami-bg border border-gami-border px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-gami-purple"
              />
            </div>

            <button
              onClick={runPlayground}
              disabled={playgroundLoading}
              className="w-full flex items-center justify-center gap-2 bg-gami-green text-gami-bg font-display font-bold py-3 shadow-brutal hover:shadow-brutal-green transition-all disabled:opacity-60"
            >
              {playgroundLoading ? (
                <>
                  <div className="w-3 h-3 border-2 border-gami-bg border-t-transparent animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play size={14} /> Run Request
                </>
              )}
            </button>
          </div>

          {playgroundResponse && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-gami-muted uppercase tracking-widest">Response</label>
                <span className="text-xs font-mono text-gami-green flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-gami-green" /> 200 OK
                </span>
              </div>
              <div className="bg-gami-bg border border-gami-green p-3">
                <pre className="text-xs font-mono text-gami-green whitespace-pre-wrap">{playgroundResponse}</pre>
              </div>
            </div>
          )}

          <div className="border-t border-gami-border pt-4 space-y-2">
            <a href="#" className="flex items-center gap-2 text-xs font-body text-gami-muted hover:text-white transition-colors">
              <ExternalLink size={12} /> Full API Reference
            </a>
            <a href="#" className="flex items-center gap-2 text-xs font-body text-gami-muted hover:text-white transition-colors">
              <ExternalLink size={12} /> Postman Collection
            </a>
            <a href="#" className="flex items-center gap-2 text-xs font-body text-gami-muted hover:text-white transition-colors">
              <ExternalLink size={12} /> OpenAPI Spec (JSON)
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
