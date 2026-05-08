import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import XPDashboard from './pages/Dashboard/XPDashboard'
import GamifiedWallet from './pages/Wallet/GamifiedWallet'
import BuilderDashboard from './pages/Builder/BuilderDashboard'
import TokenEconomy from './pages/TokenEconomy'
import AgentChat from './pages/AgentChat'
import SDKDocs from './pages/SDKDocs'
import Waitlist from './pages/Waitlist'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<XPDashboard />} />
        <Route path="/wallet" element={<GamifiedWallet />} />
        <Route path="/builder" element={<BuilderDashboard />} />
        <Route path="/token-economy" element={<TokenEconomy />} />
        <Route path="/agent" element={<AgentChat />} />
        <Route path="/docs" element={<SDKDocs />} />
        <Route path="/waitlist" element={<Waitlist />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
