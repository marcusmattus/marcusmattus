import { AgentWalletStatusSchema, type AgentWalletStatus } from '../schemas/agent';
import { config } from '../shared/config';
import { request } from './client';

/**
 * Whether NOVA is a signer on the user's wallet, and under which Privy policy.
 * Read-only: access is granted and revoked in the Gami Wallet app, never here.
 */
export function fetchAgentWallet(token: string): Promise<AgentWalletStatus> {
  return request('/agent/wallet', AgentWalletStatusSchema, { token, baseUrl: config.agentUrl });
}
