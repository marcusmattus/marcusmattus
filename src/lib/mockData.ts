// src/lib/mockData.ts

export const MOCK_USER = {
  id: 'usr_abc123',
  username: 'player_7f2a',
  avatar: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=gami',
  xp: 84320,
  level: 42,
  nextLevelXp: 100000,
  weeklyXp: 4200,
  globalRank: 4821,
  streak: 12,
  walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0f8b1',
  joinedAt: '2024-01-15',
}

export const MOCK_QUESTS = [
  { id: 'qst_01', name: 'Daily Login', app: 'Discord', appColor: '#5865F2', xpReward: 50, progress: 100, status: 'completed' as const, expiresAt: null, description: 'Log in every day to earn XP.' },
  { id: 'qst_02', name: 'First Purchase', app: 'Shopify', appColor: '#96BF48', xpReward: 500, progress: 60, status: 'in_progress' as const, expiresAt: '2026-06-01', description: 'Complete your first purchase.' },
  { id: 'qst_03', name: 'Trade $1000 Volume', app: 'Polygon DEX', appColor: '#8247E5', xpReward: 1200, progress: 25, status: 'in_progress' as const, expiresAt: '2026-06-15', description: 'Trade $1000 in volume on Polygon DEX.' },
  { id: 'qst_04', name: 'Discord Champion', app: 'Discord', appColor: '#5865F2', xpReward: 1000, progress: 85, status: 'in_progress' as const, expiresAt: '2026-05-31', description: 'Send 100 messages in Discord.' },
  { id: 'qst_05', name: 'NFT Collector', app: 'OpenSea', appColor: '#2081E2', xpReward: 750, progress: 0, status: 'available' as const, expiresAt: null, description: 'Buy your first NFT.' },
  { id: 'qst_06', name: 'Referral Master', app: 'Gami', appColor: '#6E3CFB', xpReward: 2000, progress: 33, status: 'in_progress' as const, expiresAt: null, description: 'Refer 3 friends to Gami.' },
  { id: 'qst_07', name: 'Staking Pro', app: 'Gami Finance', appColor: '#00F5A0', xpReward: 800, progress: 0, status: 'available' as const, expiresAt: '2026-07-01', description: 'Stake at least 1000 GAMI tokens.' },
]

export const MOCK_ACTIVITY = [
  { id: 'act_01', app: 'Discord', action: 'Sent message in #gami-general', xp: 10, timestamp: '2026-05-08T09:12:00Z', txHash: '0xabc123...def456' },
  { id: 'act_02', app: 'Shopify', action: 'Added item to cart', xp: 25, timestamp: '2026-05-08T08:45:00Z', txHash: '0xbcd234...ef5678' },
  { id: 'act_03', app: 'Polygon DEX', action: 'Swapped 0.5 ETH → USDC', xp: 120, timestamp: '2026-05-08T07:30:00Z', txHash: '0xcde345...f67890' },
  { id: 'act_04', app: 'Gami', action: 'Completed Daily Login quest', xp: 50, timestamp: '2026-05-08T06:00:00Z', txHash: '0xdef456...012345' },
  { id: 'act_05', app: 'OpenSea', action: 'Viewed NFT collection', xp: 5, timestamp: '2026-05-07T22:15:00Z', txHash: '0xef5678...123456' },
  { id: 'act_06', app: 'Discord', action: 'Sent 10 messages', xp: 30, timestamp: '2026-05-07T20:00:00Z', txHash: '0xf67890...234567' },
  { id: 'act_07', app: 'Gami Finance', action: 'Staked 500 GAMI', xp: 200, timestamp: '2026-05-07T18:30:00Z', txHash: '0x012345...345678' },
  { id: 'act_08', app: 'Shopify', action: 'Completed First Purchase', xp: 300, timestamp: '2026-05-07T16:00:00Z', txHash: '0x123456...456789' },
]

export const MOCK_TOKENS = [
  { symbol: 'GAMI', name: 'Gami Protocol', balance: '12,847.50', usdValue: 6423.75, change24h: 12.4, chain: 'Base', logo: '🎮' },
  { symbol: 'ETH', name: 'Ethereum', balance: '0.8420', usdValue: 3125.40, change24h: -1.2, chain: 'Base', logo: '⟠' },
  { symbol: 'SOL', name: 'Solana', balance: '12.30', usdValue: 1722.00, change24h: 5.7, chain: 'Solana', logo: '◎' },
  { symbol: 'USDC', name: 'USD Coin', balance: '2,500.00', usdValue: 2500.00, change24h: 0.01, chain: 'Polygon', logo: '💵' },
  { symbol: 'MATIC', name: 'Polygon', balance: '4,200.00', usdValue: 3192.00, change24h: 3.2, chain: 'Polygon', logo: '⬡' },
]

export const MOCK_NFTS = [
  { id: 'nft_01', name: 'Gami Genesis #001', collection: 'Gami Genesis', rarity: 'legendary' as const, image: '🏆', earnedAt: '2026-01-15', chain: 'Base' },
  { id: 'nft_02', name: 'Quest Master #042', collection: 'Quest Masters', rarity: 'epic' as const, image: '⚔️', earnedAt: '2026-02-20', chain: 'Polygon' },
  { id: 'nft_03', name: 'XP Crusher #117', collection: 'XP Series', rarity: 'rare' as const, image: '⚡', earnedAt: '2026-03-10', chain: 'Base' },
  { id: 'nft_04', name: 'DeFi Pioneer #008', collection: 'DeFi Pioneers', rarity: 'legendary' as const, image: '🌊', earnedAt: '2026-03-25', chain: 'Arbitrum' },
  { id: 'nft_05', name: 'Streak Warrior #23', collection: 'Streak Warriors', rarity: 'common' as const, image: '🔥', earnedAt: '2026-04-01', chain: 'Base' },
  { id: 'nft_06', name: 'Social Butterfly #56', collection: 'Social Series', rarity: 'rare' as const, image: '🦋', earnedAt: '2026-04-15', chain: 'Polygon' },
  { id: 'nft_07', name: 'Power Buyer #91', collection: 'Commerce Kings', rarity: 'epic' as const, image: '👑', earnedAt: '2026-04-30', chain: 'Base' },
  { id: 'nft_08', name: 'Early Adopter #3', collection: 'OG Series', rarity: 'legendary' as const, image: '🌟', earnedAt: '2026-01-01', chain: 'Base' },
]

export const MOCK_TRANSACTIONS = [
  { id: 'tx_01', date: '2026-05-08', type: 'earn' as const, app: 'Discord', amount: '+50 XP', tokenAmount: '+5 GAMI', chain: 'Base', status: 'confirmed' as const, hash: '0xabc123' },
  { id: 'tx_02', date: '2026-05-08', type: 'earn' as const, app: 'Shopify', amount: '+300 XP', tokenAmount: '+30 GAMI', chain: 'Polygon', status: 'confirmed' as const, hash: '0xbcd234' },
  { id: 'tx_03', date: '2026-05-07', type: 'spend' as const, app: 'Gami', amount: '-100 GAMI', tokenAmount: '-100 GAMI', chain: 'Base', status: 'confirmed' as const, hash: '0xcde345' },
  { id: 'tx_04', date: '2026-05-07', type: 'bridge' as const, app: 'LayerZero', amount: '500 GAMI', tokenAmount: '500 GAMI', chain: 'Base→Polygon', status: 'confirmed' as const, hash: '0xdef456' },
  { id: 'tx_05', date: '2026-05-06', type: 'earn' as const, app: 'Polygon DEX', amount: '+1200 XP', tokenAmount: '+120 GAMI', chain: 'Polygon', status: 'confirmed' as const, hash: '0xef5678' },
  { id: 'tx_06', date: '2026-05-06', type: 'earn' as const, app: 'OpenSea', amount: '+750 XP', tokenAmount: '+75 GAMI', chain: 'Base', status: 'pending' as const, hash: '0xf01234' },
  { id: 'tx_07', date: '2026-05-05', type: 'earn' as const, app: 'Gami Finance', amount: '+200 XP', tokenAmount: '+20 GAMI', chain: 'Base', status: 'confirmed' as const, hash: '0x012345' },
  { id: 'tx_08', date: '2026-05-05', type: 'spend' as const, app: 'Gami Store', amount: '-250 GAMI', tokenAmount: '-250 GAMI', chain: 'Base', status: 'confirmed' as const, hash: '0x123456' },
]

export const MOCK_LEADERBOARD = [
  { rank: 1, username: 'xp_whale_9k', xp: 284500, level: 89, streak: 42, avatar: '🐋' },
  { rank: 2, username: 'quest_lord', xp: 271200, level: 85, streak: 31, avatar: '⚔️' },
  { rank: 3, username: 'defi_grinder', xp: 259800, level: 82, streak: 28, avatar: '⚡' },
  { rank: 4, username: 'nft_collector_pro', xp: 248100, level: 79, streak: 19, avatar: '🎨' },
  { rank: 5, username: 'gami_og_001', xp: 235600, level: 76, streak: 55, avatar: '👑' },
  { rank: 4821, username: 'player_7f2a', xp: 84320, level: 42, streak: 12, avatar: '🎮', isCurrentUser: true },
]

export const MOCK_XP_HISTORY = [
  { day: 'Mon', xp: 420 }, { day: 'Tue', xp: 380 }, { day: 'Wed', xp: 650 },
  { day: 'Thu', xp: 290 }, { day: 'Fri', xp: 810 }, { day: 'Sat', xp: 520 }, { day: 'Sun', xp: 1130 },
]

export const MOCK_XP_BREAKDOWN = [
  { name: 'Gaming', value: 38, color: '#6E3CFB' },
  { name: 'Shopping', value: 22, color: '#00F5A0' },
  { name: 'DeFi', value: 27, color: '#F5C518' },
  { name: 'Social', value: 13, color: '#9C6CFF' },
]

export const MOCK_CAMPAIGNS = [
  { id: 'camp_01', name: 'Summer Power-Up', status: 'active' as const, start: '2026-05-01', players: 12480, xpAwarded: '2.4M', budgetUsed: 68 },
  { id: 'camp_02', name: 'Onboarding Blitz', status: 'active' as const, start: '2026-04-15', players: 8320, xpAwarded: '1.1M', budgetUsed: 45 },
  { id: 'camp_03', name: 'DeFi Spring', status: 'ended' as const, start: '2026-03-01', players: 21100, xpAwarded: '5.2M', budgetUsed: 100 },
  { id: 'camp_04', name: 'NFT Drop Campaign', status: 'draft' as const, start: '2026-06-01', players: 0, xpAwarded: '0', budgetUsed: 0 },
]

export const MOCK_DAU_DATA = [
  { date: 'Apr 28', dau: 42100 }, { date: 'Apr 29', dau: 44800 }, { date: 'Apr 30', dau: 41200 },
  { date: 'May 1', dau: 48900 }, { date: 'May 2', dau: 52300 }, { date: 'May 3', dau: 49800 },
  { date: 'May 4', dau: 38200 }, { date: 'May 5', dau: 41500 }, { date: 'May 6', dau: 55700 },
  { date: 'May 7', dau: 58900 }, { date: 'May 8', dau: 62100 },
]

export const MOCK_TICKER_EVENTS = [
  '@player_7f2a earned 250 XP in Fortnite',
  'Brand X distributed 1.2M GAMI tokens',
  '@nft_whale claimed Legendary Genesis NFT',
  'New partner: Shopify plugin live — 50K stores eligible',
  '@quest_lord hit Level 85 🎉',
  '@defi_grinder completed $1M trading volume quest',
  '312 apps now live on Gami Protocol',
  '@gami_og_001 on a 55-day streak 🔥',
  'Weekly leaderboard reset — race to the top!',
  '2.4 Billion total XP distributed across all apps',
]
