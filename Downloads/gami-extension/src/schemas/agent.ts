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

/**
 * NOVA as a Privy signer on the user's wallet. `scoped` means the signer is bound to the
 * policy Gami expects; `unrestricted` and `mismatched` are states the user should revoke.
 */
export const NovaGrantSchema = z.enum(['none', 'scoped', 'unrestricted', 'mismatched', 'unsupported']);
export type NovaGrant = z.infer<typeof NovaGrantSchema>;

export const AgentWalletStatusSchema = z.object({
  configured: z.boolean(),
  signerId: z.string().max(128).nullable(),
  policyIds: z.array(z.string().max(128)).max(8),
  wallet: z.object({ address: z.string().max(128), grant: NovaGrantSchema }).nullable(),
});
export type AgentWalletStatus = z.infer<typeof AgentWalletStatusSchema>;

export const NovaReplySchema = z.object({
  reply: z.string().max(4000),
  toolRequest: z.object({
    tool: z.string().max(128),
    args: z.record(z.unknown()).default({}),
  }).optional(),
});
export type NovaReply = z.infer<typeof NovaReplySchema>;
