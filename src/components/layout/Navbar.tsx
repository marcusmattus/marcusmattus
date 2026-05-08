import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Zap, Menu, X, Wallet } from 'lucide-react'

const navLinks = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Wallet', path: '/wallet' },
  { label: 'Builder', path: '/builder' },
  { label: 'Token', path: '/token-economy' },
  { label: 'AI Agent', path: '/agent' },
  { label: 'Docs', path: '/docs' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gami-bg border-b border-gami-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-gami-purple flex items-center justify-center shadow-brutal-sm group-hover:shadow-brutal-purple transition-shadow">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">
            GAMI<span className="text-gami-green">.</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 text-sm font-medium font-body transition-colors ${
                location.pathname === link.path
                  ? 'text-gami-green border-b-2 border-gami-green'
                  : 'text-gami-muted hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            to="/waitlist"
            className="text-sm text-gami-muted hover:text-white transition-colors font-body px-3 py-2"
          >
            Waitlist
          </Link>
          <Link
            to="/auth"
            className="flex items-center gap-2 bg-gami-purple text-white text-sm font-semibold font-display px-4 py-2 shadow-brutal hover:shadow-brutal-purple hover:-translate-y-0.5 transition-all"
          >
            <Wallet size={14} />
            Connect Wallet
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden text-gami-muted hover:text-white p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-gami-surface border-t border-gami-border">
          <div className="px-6 py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`py-2 text-sm font-medium ${
                  location.pathname === link.path ? 'text-gami-green' : 'text-gami-muted'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/auth"
              onClick={() => setMobileOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 bg-gami-purple text-white text-sm font-semibold px-4 py-3 shadow-brutal"
            >
              <Wallet size={14} />
              Connect Wallet
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
