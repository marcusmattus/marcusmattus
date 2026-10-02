import { z } from 'zod';
import { QuestRewardSchema } from './quest';

export const QuestEvidenceSchema = z.object({
  kind: z.literal('partner_signature'),
  questId: z.string().min(1).max(128),
  campaignId: z.string().optional(),
  origin: z.string().url(),
  eventId: z.string().min(1).max(128),
  nonce: z.string().min(16).max(128),
  timestamp: z.string().datetime(),
  signature: z.string().regex(/^[0-9a-f]{64}$/),
});
export type QuestEvidence = z.infer<typeof QuestEvidenceSchema>;

export const QuestSubmissionResultSchema = z.object({
  submissionId: z.string().min(1),
  questId: z.string().min(1),
  status: z.enum(['pending', 'verified', 'rejected']),
  rewardIntentId: z.string().optional(),
  reason: z.string().max(200).optional(),
});
export type QuestSubmissionResult = z.infer<typeof QuestSubmissionResultSchema>;

export const RewardIntentSchema = z.object({
  intentId: z.string().min(1),
  userId: z.string().min(1),
  walletAddress: z.string(),
  questId: z.string().min(1),
  campaignId: z.string().optional(),
  eventId: z.string().min(1),
  reward: QuestRewardSchema,
  status: z.enum(['pending', 'approved', 'dispatched', 'confirmed', 'rejected']),
});
export type RewardIntent = z.infer<typeof RewardIntentSchema>;

/** questId:userId:completionId — the same key for every retry of one completion. */
export function idempotencyKey(questId: string, userId: string, completionId: string): string {
  return `${questId}:${userId}:${completionId}`;
}
