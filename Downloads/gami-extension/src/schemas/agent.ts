import { z } from 'zod';

export const GamiAgentCredentialSchema = z.object({
  agentId: z.string().min(1),
  userId: z.string().min(1),
  walletAddress: z.string(),
  scopes: z.array(z.string().max(64)).max(32),
  questIds: z.array(z.string()).optional(),
  campaignIds: z.array(z.string()).optional(),
  expiresAt: z.string().datetime(),
  sessionId: z.string().min(1),
  token: z.string().min(1),
});
export type GamiAgentCredential = z.infer<typeof GamiAgentCredentialSchema>;

export const NovaReplySchema = z.object({
  reply: z.string().max(4000),
  toolRequest: z.object({
    tool: z.string().max(128),
    args: z.record(z.unknown()).default({}),
  }).optional(),
});
export type NovaReply = z.infer<typeof NovaReplySchema>;
