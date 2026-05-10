import { useState, useRef, useEffect } from 'react'
import { Send, Zap, Bot, User, Target, TrendingUp, Tag } from 'lucide-react'
import Navbar from '../components/layout/Navbar'
import XPBar from '../components/xp/XPBar'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; result: string }[]
  timestamp: string
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: "Hey! I'm your Gami AI Agent. I have full access to your XP data, quest progress, and token balances. What would you like to know?",
    timestamp: '10:42 AM',
  },
  {
    id: '2',
    role: 'user',
    content: "What's my current XP balance and what quests should I prioritize?",
    timestamp: '10:43 AM',
  },
  {
    id: '3',
    role: 'assistant',
    content: "Let me check your current state...",
    toolCalls: [
      { name: 'get_xp_balance', result: '{ "xp": 24850, "level": 42, "rank": 4821 }' },
      { name: 'get_active_quests', result: '{ "quests": [{"id":"q1","progress":0.85,"xp":1000},{"id":"q2","progress":0.6,"xp":500}] }' },
    ],
    timestamp: '10:43 AM',
  },
  {
    id: '4',
    role: 'assistant',
    content: "You have **24,850 XP** at Level 42, ranked #4,821 globally. Based on your quest progress:\n\n🎯 **Discord Champion** is 85% complete — highest priority! Just 15% more to claim **1,000 XP**.\n\n🛒 **First Purchase** is 60% done for **500 XP**.\n\n💡 Pro tip: Completing Discord Champion tonight will push you to Level 43 and unlock the Gold multiplier tier.",
    timestamp: '10:43 AM',
  },
  {
    id: '5',
    role: 'user',
    content: "How much GAMI do I have and what's the best staking tier for me?",
    timestamp: '10:45 AM',
  },
  {
    id: '6',
    role: 'assistant',
    content: "Checking your wallet...",
    toolCalls: [
      { name: 'get_balance', result: '{ "GAMI": 1247.5, "ETH": 0.842, "SOL": 12.3 }' },
      { name: 'get_staking_rates', result: '{ "bronze": "8%", "silver": "14%", "gold": "22%", "diamond": "36%" }' },
    ],
    timestamp: '10:45 AM',
  },
  {
    id: '7',
    role: 'assistant',
    content: "You hold **1,247.5 GAMI** (~$372 at current prices).\n\nYou're slightly below the **Bronze tier** threshold (1,000 GAMI ✓). At Bronze staking:\n- **8% APY** → ~+99.8 GAMI/year\n- **1.5x XP multiplier** on all quests\n- Early access to new quest drops\n\nIf you buy **8,752.5 more GAMI** (~$2,608), you'd reach Silver at **14% APY + 2x XP**. That's a 6% better return and doubles your quest XP. Worth considering!",
    timestamp: '10:45 AM',
  },
]

const suggestedPrompts = [
  "What's my quest progress today?",
  "Optimize my XP earning strategy",
  "When will I reach the next level?",
  "What NFTs are in my wallet?",
  "Show me the top leaderboard players",
  "How do I earn more GAMI tokens?",
]

const agentMemory = [
  { tag: 'user.level', val: '42' },
  { tag: 'user.xp', val: '24,850' },
  { tag: 'active.quests', val: '3' },
  { tag: 'streak.days', val: '14' },
  { tag: 'wallet.gami', val: '1,247.5' },
  { tag: 'rank.global', val: '#4,821' },
]

const activeQuests = [
  { title: 'Discord Champion', progress: 85, xp: 1000, color: '#6E3CFB' },
  { title: 'First Purchase', progress: 60, xp: 500, color: '#00F5A0' },
  { title: 'Polygon Quest', progress: 30, xp: 750, color: '#F5C518' },
]

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-gami-surface border border-gami-border w-fit">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-gami-accent"
          style={{
            animation: 'bounce-dot 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </div>
  )
}

export default function AgentChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Clear any pending reply timer when the component unmounts
  useEffect(() => () => { if (replyTimerRef.current) clearTimeout(replyTimerRef.current) }, [])

  const sendMessage = (text?: string) => {
    const content = text || input.trim()
    if (!content) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    // Cancel any in-flight reply before scheduling a new one
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current)
    replyTimerRef.current = setTimeout(() => {
      setIsTyping(false)
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I've analyzed your request using your live XP data. Based on your current Level 42 status and 14-day streak, your next best move is to complete the Discord Champion quest — you're 85% there and it's worth 1,000 XP which would push you to Level 43!",
        toolCalls: [
          { name: 'analyze_quest_priority', result: '{ "recommended": "discord_champion", "completion_eta": "2h" }' },
        ],
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, reply])
    }, 1800)
  }

  return (
    <div className="min-h-screen bg-gami-bg">
      <Navbar />
      <div className="pt-16 flex min-h-screen">
        {/* CHAT AREA */}
        <main className="flex-1 flex flex-col lg:mr-80">
          {/* Chat Header */}
          <div className="bg-gami-surface border-b border-gami-border px-6 py-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gami-purple flex items-center justify-center shadow-brutal-sm">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <div className="font-display font-semibold text-white text-sm">Gami AI Agent</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-gami-green animate-pulse" />
                <span className="text-xs font-mono text-gami-green">Online · Real-time XP access</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center text-sm ${
                  msg.role === 'assistant'
                    ? 'bg-gami-purple'
                    : 'bg-gami-surface border border-gami-border'
                }`}>
                  {msg.role === 'assistant' ? (
                    <Bot size={14} className="text-white" />
                  ) : (
                    <User size={14} className="text-gami-muted" />
                  )}
                </div>

                <div className={`max-w-[70%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''} flex flex-col`}>
                  {/* Tool Call Badges */}
                  {msg.toolCalls && (
                    <div className="flex flex-wrap gap-2">
                      {msg.toolCalls.map((tc) => (
                        <div
                          key={tc.name}
                          className="flex items-center gap-1.5 bg-gami-bg border border-gami-purple px-2.5 py-1"
                        >
                          <Zap size={10} className="text-gami-yellow" fill="currentColor" />
                          <span className="text-xs font-mono text-gami-accent">{tc.name}</span>
                          <span className="text-xs font-mono text-gami-green">called</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  {msg.content && msg.content !== "Let me check your current state..." && msg.content !== "Checking your wallet..." && msg.content !== "Let me check your wallet..." && (
                    <div
                      className={`px-4 py-3 text-sm font-sans leading-relaxed whitespace-pre-line ${
                        msg.role === 'user'
                          ? 'bg-gami-purple text-white shadow-brutal-sm border border-gami-purple'
                          : 'bg-gami-surface text-white border border-gami-border shadow-brutal-sm'
                      }`}
                    >
                      {msg.content
                        .split('**')
                        .map((part, i) => i % 2 === 1
                          ? <strong key={i} className="font-semibold text-gami-green">{part}</strong>
                          : part
                        )}
                    </div>
                  )}

                  <div className={`text-xs font-mono text-gami-muted ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3 items-start">
                <div className="w-8 h-8 flex-shrink-0 bg-gami-purple flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <TypingIndicator />
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggested Prompts */}
          <div className="px-6 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {suggestedPrompts.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="flex-shrink-0 text-xs font-sans text-gami-muted bg-gami-surface border border-gami-border px-3 py-1.5 hover:text-white hover:border-gami-purple transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="bg-gami-surface border-t border-gami-border p-4 flex gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask about your XP, quests, wallet..."
                className="w-full bg-gami-bg border border-gami-border px-4 py-3 text-white font-sans text-sm placeholder-gami-muted focus:outline-none focus:border-gami-purple transition-colors"
              />
            </div>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim()}
              className="w-12 h-12 bg-gami-purple flex items-center justify-center text-white shadow-brutal hover:shadow-brutal-purple disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </main>

        {/* CONTEXT PANEL */}
        <aside className="hidden lg:flex flex-col w-80 bg-gami-surface border-l border-gami-border fixed right-0 top-16 bottom-0 overflow-y-auto p-5 gap-5">
          {/* XP Snapshot */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-gami-green" />
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Live XP Snapshot</span>
            </div>
            <div className="font-mono font-bold text-gami-green text-3xl mb-1">24,850</div>
            <div className="text-xs font-mono text-gami-muted mb-3">Level 42 · Rank #4,821</div>
            <XPBar current={24850} max={30000} level={42} />
          </div>

          {/* Active Quests */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-3">
              <Target size={14} className="text-gami-yellow" />
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Active Quests</span>
            </div>
            <div className="space-y-3">
              {activeQuests.map((q) => (
                <div key={q.title}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-sans text-gami-muted">{q.title}</span>
                    <span className="text-xs font-mono" style={{ color: q.color }}>{q.progress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gami-border">
                    <div
                      className="h-full transition-all"
                      style={{ width: `${q.progress}%`, background: q.color, boxShadow: `0 0 6px ${q.color}60` }}
                    />
                  </div>
                  <div className="text-xs font-mono text-gami-muted mt-0.5">+{q.xp} XP reward</div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Memory */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-3">
              <Tag size={14} className="text-gami-accent" />
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Agent Memory</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {agentMemory.map((m) => (
                <div key={m.tag} className="bg-gami-surface border border-gami-border px-2 py-1">
                  <span className="text-xs font-mono text-gami-muted">{m.tag}: </span>
                  <span className="text-xs font-mono text-gami-green">{m.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Tool Calls */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-gami-yellow" fill="currentColor" />
              <span className="text-xs font-mono text-gami-muted uppercase tracking-widest">Tool Calls</span>
            </div>
            <div className="space-y-2">
              {[
                { name: 'get_xp_balance', status: 'success', time: '10:43' },
                { name: 'get_active_quests', status: 'success', time: '10:43' },
                { name: 'get_balance', status: 'success', time: '10:45' },
                { name: 'get_staking_rates', status: 'success', time: '10:45' },
              ].map((tc, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs font-mono text-gami-accent">{tc.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gami-muted">{tc.time}</span>
                    <div className="w-1.5 h-1.5 bg-gami-green" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agent Capabilities */}
          <div className="bg-gami-bg border border-gami-border p-4 shadow-brutal-sm">
            <span className="text-xs font-mono text-gami-muted uppercase tracking-widest block mb-3">Capabilities</span>
            <div className="space-y-1.5">
              {[
                'Read XP & quest data',
                'Analyze wallet balances',
                'Suggest quest strategies',
                'Calculate level projections',
                'Compare staking tiers',
                'Track leaderboard rank',
              ].map((cap) => (
                <div key={cap} className="flex items-center gap-2 text-xs font-sans text-gami-muted">
                  <span className="text-gami-green">✓</span> {cap}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
