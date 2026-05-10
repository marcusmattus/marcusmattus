export type QuestStatus = 'available' | 'in_progress' | 'completed' | 'expired'

export interface Quest {
  id: string
  name: string
  description: string
  app: string
  appColor: string
  xpReward: number
  progress: number
  status: QuestStatus
  expiresAt: string | null
}
