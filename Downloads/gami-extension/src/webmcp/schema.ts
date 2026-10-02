import { z } from 'zod';

export const WebMcpToolSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_.]{1,63}$/),
  description: z.string().max(280),
  inputSchema: z.record(z.unknown()),
  riskLevel: z.enum(['read', 'interaction', 'transaction', 'sensitive']),
  requiresConfirmation: z.boolean(),
});
export type WebMcpTool = z.infer<typeof WebMcpToolSchema>;
