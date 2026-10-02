import { z } from 'zod';

export const QUEST_TYPES = [
  'PAGE_VISIT', 'CONTENT_VIEW', 'BUTTON_ACTION', 'QR_SCAN',
  'EVENT_REGISTER', 'EVENT_CHECK_IN', 'QUIZ_COMPLETE', 'CUSTOM_MCP_ACTION',
] as const;

export const QuestRewardSchema = z.object({
  type: z.enum(['XP', 'POINTS', 'TOKEN', 'BADGE']),
  amount: z.string().regex(/^\d+$/).optional(),
  asset: z.string().max(64).optional(),
});
export type QuestReward = z.infer<typeof QuestRewardSchema>;

export const QuestRequirementSchema = z.object({
  type: z.enum(QUEST_TYPES),
  description: z.string().max(280),
});
export type QuestRequirement = z.infer<typeof QuestRequirementSchema>;

export const QuestVerificationSchema = z.object({
  type: z.enum(['server_proof', 'partner_signature', 'gami_qr', 'onchain', 'webmcp_result']),
  label: z.string().max(80),
});
export type QuestVerification = z.infer<typeof QuestVerificationSchema>;

export const QuestSchema = z.object({
  id: z.string().min(1).max(128),
  creatorId: z.string().min(1),
  campaignId: z.string().optional(),
  title: z.string().min(1).max(120),
  description: z.string().max(500),
  category: z.string().max(64),
  status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'expired']),
  requirements: z.array(QuestRequirementSchema).max(10),
  verification: QuestVerificationSchema,
  reward: QuestRewardSchema,
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  maxCompletions: z.number().int().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Quest = z.infer<typeof QuestSchema>;
export const QuestListSchema = z.object({ quests: z.array(QuestSchema).max(50) });

export const QuestStartSchema = z.object({
  startId: z.string().min(1),
  nonce: z.string().min(16).max(128),
  expiresAt: z.string().datetime(),
});
export type QuestStart = z.infer<typeof QuestStartSchema>;
