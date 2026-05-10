import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Pages
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import XPDashboard from './pages/Dashboard/XPDashboard'
import QuestFeed from './pages/Dashboard/QuestFeed'
import Leaderboard from './pages/Dashboard/Leaderboard'
import GamifiedWallet from './pages/Wallet/GamifiedWallet'
import TokenHistory from './pages/Wallet/TokenHistory'
import BuilderDashboard from './pages/Builder/BuilderDashboard'
import CampaignEditor from './pages/Builder/CampaignEditor'
import Analytics from './pages/Builder/Analytics'
import TokenEconomy from './pages/TokenEconomy'
import AgentChat from './pages/AgentChat'
import SDKDocs from './pages/SDKDocs'
import Waitlist from './pages/Waitlist'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<XPDashboard />} />
          <Route path="/dashboard/quests" element={<QuestFeed />} />
          <Route path="/dashboard/leaderboard" element={<Leaderboard />} />
          <Route path="/wallet" element={<GamifiedWallet />} />
          <Route path="/wallet/history" element={<TokenHistory />} />
          <Route path="/builder" element={<BuilderDashboard />} />
          <Route path="/builder/campaign/:id" element={<CampaignEditor />} />
          <Route path="/builder/analytics" element={<Analytics />} />
          <Route path="/token-economy" element={<TokenEconomy />} />
          <Route path="/agent" element={<AgentChat />} />
          <Route path="/docs" element={<SDKDocs />} />
          <Route path="/waitlist" element={<Waitlist />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
