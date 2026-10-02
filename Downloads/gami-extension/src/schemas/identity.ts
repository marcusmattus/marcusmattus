import { z } from 'zod';

export const GamiIdentitySchema = z.object({
  id: z.string().min(1),
  privyUserId: z.string().min(1),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  network: z.literal('gami-1'),
});
export type GamiIdentity = z.infer<typeof GamiIdentitySchema>;

export const XpSchema = z.object({
  xp: z.number().int().nonnegative(),
  level: z.number().int().nonnegative(),
  nextLevelXp: z.number().int().positive().optional(),
});
export const PointsSchema = z.object({ points: z.number().int().nonnegative() });
export type Balances = z.infer<typeof XpSchema> & z.infer<typeof PointsSchema>;
