export interface Token {
  symbol: string
  name: string
  balance: string
  usdValue: number
  change24h: number
  chain: string
  logo: string
}

export interface NFT {
  id: string
  name: string
  collection: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  image: string
  earnedAt: string
  chain: string
}

export type TxStatus = 'pending' | 'confirmed' | 'failed'

export interface Transaction {
  id: string
  date: string
  type: 'earn' | 'spend' | 'bridge'
  app: string
  amount: string
  tokenAmount: string
  chain: string
  status: TxStatus
  hash: string
}
