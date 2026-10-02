// src/lib/anthropic.ts

export interface AnthropicContent {
  type: 'text' | 'tool_use' | 'tool_result'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: string
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContent[]
}

const SYSTEM_PROMPT = `You are Gami, an AI quest agent for the Gami Protocol.
You help users earn XP, complete quests, and redeem rewards.
You have access to real-time tools to fetch live user data.
Be encouraging, technical, and slightly playful. Keep responses concise.
Always reference the user's actual XP and quest data from tool results.`

const TOOLS = [
  {
    name: 'get_user_xp',
    description: "Get the user's current XP balance and level",
    input_schema: {
      type: 'object',
      properties: { userId: { type: 'string', description: 'User ID' } },
      required: ['userId'],
    },
  },
  {
    name: 'get_active_quests',
    description: 'Get quests available for the user to complete',
    input_schema: {
      type: 'object',
      properties: { userId: { type: 'string' } },
      required: ['userId'],
    },
  },
  {
    name: 'grant_xp',
    description: 'Award XP to a user for a specific reason',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        amount: { type: 'number', description: 'XP to award (max 10000)' },
        reason: { type: 'string' },
      },
      required: ['userId', 'amount', 'reason'],
    },
  },
  {
    name: 'redeem_reward',
    description: 'Redeem an available reward for the user',
    input_schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        rewardId: { type: 'string' },
      },
      required: ['userId', 'rewardId'],
    },
  },
]

// Suppress unused variable warning — TOOLS is the canonical shape reference
void TOOLS

/** Mock tool execution — replace with real API calls in production */
export function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'get_user_xp':
      return JSON.stringify({ xp: 84320, level: 42, nextLevelXp: 100000, progressPercent: 84 })
    case 'get_active_quests':
      return JSON.stringify([
        { id: 'qst_02', name: 'First Purchase', xpReward: 500, progress: 60 },
        { id: 'qst_04', name: 'Discord Champion', xpReward: 1000, progress: 85 },
        { id: 'qst_03', name: 'Trade $1000 Volume', xpReward: 1200, progress: 25 },
      ])
    case 'grant_xp': {
      const amount = (input.amount as number) ?? 0
      return JSON.stringify({ success: true, newTotal: 84320 + amount, txId: 'tx_' + Math.random().toString(36).slice(2) })
    }
    case 'redeem_reward':
      return JSON.stringify({ success: true, rewardName: 'Mystery NFT Pack', deliveryNote: 'Check your wallet in 2-3 minutes.' })
    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

/** Returns a realistic mock Anthropic response so the UI is fully demoed without an API key */
export async function sendAgentMessage(
  messages: AnthropicMessage[],
  _apiKey?: string,
): Promise<{ content: AnthropicContent[] }> {
  const last = messages[messages.length - 1]
  const text = typeof last?.content === 'string' ? last.content.toLowerCase() : ''

  // Simulate network latency
  await new Promise((r) => setTimeout(r, 600))

  if (text.includes('quest')) {
    return {
      content: [
        { type: 'tool_use', id: 'tu_01', name: 'get_active_quests', input: { userId: 'usr_abc123' } },
        {
          type: 'text',
          text: "🎯 You have **3 active quests**! Your best bet is **Discord Champion** — you're 85% there and it pays **1,000 XP**, pushing you to Level 43. Want me to set a reminder?",
        },
      ],
    }
  }
  if (text.includes('xp') || text.includes('level')) {
    return {
      content: [
        { type: 'tool_use', id: 'tu_02', name: 'get_user_xp', input: { userId: 'usr_abc123' } },
        {
          type: 'text',
          text: "⚡ You're at **84,320 XP** (Level 42) — just **15,680 XP from Level 43**. Your 12-day streak gives a 1.5× multiplier on Discord actions. Keep it up!",
        },
      ],
    }
  }
  if (text.includes('redeem') || text.includes('reward')) {
    return {
      content: [
        { type: 'tool_use', id: 'tu_03', name: 'redeem_reward', input: { userId: 'usr_abc123', rewardId: 'rwd_mystery_nft' } },
        {
          type: 'text',
          text: "🎁 Done! I've redeemed your **Mystery NFT Pack**. It'll appear in your wallet in 2-3 minutes. Your GAMI balance has been updated.",
        },
      ],
    }
  }
  if (text.includes('streak')) {
    return {
      content: [
        {
          type: 'text',
          text: "🔥 You're on a **12-day streak** — top 8% this month! One more week unlocks the **Streak Warrior NFT**. Don't break the chain!",
        },
      ],
    }
  }
  // Default
  return {
    content: [
      { type: 'tool_use', id: 'tu_04', name: 'get_user_xp', input: { userId: 'usr_abc123' } },
      {
        type: 'text',
        text: "Hey **player_7f2a**! 👾 You've got **84,320 XP** at Level 42 with a **12-day streak**. I can help you find the best quests, check your rewards, or boost your XP. What's the move?",
      },
    ],
  }
}

export { SYSTEM_PROMPT }
