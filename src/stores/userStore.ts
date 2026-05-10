import { create } from 'zustand'
import { MOCK_USER } from '../lib/mockData'

interface UserState {
  user: typeof MOCK_USER
  isAuthenticated: boolean
  authTab: 'player' | 'partner' | 'admin'
  setAuthTab: (tab: 'player' | 'partner' | 'admin') => void
  login: () => void
  logout: () => void
  addXP: (amount: number) => void
}

export const useUserStore = create<UserState>((set) => ({
  user: MOCK_USER,
  isAuthenticated: false,
  authTab: 'player',
  setAuthTab: (tab) => set({ authTab: tab }),
  login: () => set({ isAuthenticated: true }),
  logout: () => set({ isAuthenticated: false }),
  addXP: (amount) => set((state) => ({
    user: { ...state.user, xp: state.user.xp + amount, weeklyXp: state.user.weeklyXp + amount },
  })),
}))
