export interface XPTransaction {
  id: string
  userId: string
  amount: number
  reason: string
  sourceType: 'quest' | 'bonus' | 'manual' | 'referral' | 'bridge'
  sourceId: string
  timestamp: string
  reversible: boolean
}

export interface UserXPProfile {
  userId: string
  totalXp: number
  level: number
  nextLevelXp: number
  weeklyXp: number
  globalRank: number
  streak: number
}
