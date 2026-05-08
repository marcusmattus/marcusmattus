import { Link } from 'react-router-dom'
import { Zap, Twitter, Github, MessageCircle, ExternalLink } from 'lucide-react'

const footerLinks = {
  Protocol: [
    { label: 'How It Works', path: '/#how-it-works' },
    { label: 'Token Economy', path: '/token-economy' },
    { label: 'Whitepaper', path: '#' },
    { label: 'Roadmap', path: '#' },
  ],
  Developers: [
    { label: 'SDK Docs', path: '/docs' },
    { label: 'API Reference', path: '/docs' },
    { label: 'Builder Dashboard', path: '/builder' },
    { label: 'GitHub', path: '#' },
  ],
  Community: [
    { label: 'Discord', path: '#' },
    { label: 'Twitter', path: '#' },
    { label: 'Blog', path: '#' },
    { label: 'Waitlist', path: '/waitlist' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-gami-surface border-t border-gami-border">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gami-purple flex items-center justify-center shadow-brutal-sm">
                <Zap size={18} className="text-white" fill="white" />
              </div>
              <span className="font-display font-bold text-xl text-white">
                GAMI<span className="text-gami-green">.</span>
              </span>
            </Link>
            <p className="text-gami-muted text-sm font-body leading-relaxed mb-6">
              Universal Gamification Infrastructure for the on-chain economy.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="w-9 h-9 bg-gami-bg border border-gami-border flex items-center justify-center text-gami-muted hover:text-white hover:border-gami-purple transition-colors"
              >
                <Twitter size={16} />
              </a>
              <a
                href="#"
                className="w-9 h-9 bg-gami-bg border border-gami-border flex items-center justify-center text-gami-muted hover:text-white hover:border-gami-purple transition-colors"
              >
                <Github size={16} />
              </a>
              <a
                href="#"
                className="w-9 h-9 bg-gami-bg border border-gami-border flex items-center justify-center text-gami-muted hover:text-white hover:border-gami-purple transition-colors"
              >
                <MessageCircle size={16} />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-white text-sm uppercase tracking-widest mb-4">
                {category}
              </h4>
              <ul className="flex flex-col gap-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.path}
                      className="text-gami-muted hover:text-white text-sm font-body transition-colors flex items-center gap-1 group"
                    >
                      {link.label}
                      {link.path === '#' && (
                        <ExternalLink
                          size={10}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gami-border mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gami-muted text-sm font-body">
            © 2024 Gami Protocol. All rights reserved.
          </p>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-gami-green animate-pulse" />
            <span className="text-gami-muted text-xs font-mono">
              Protocol Status: OPERATIONAL
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#" className="text-gami-muted hover:text-white text-sm transition-colors">
              Privacy
            </a>
            <a href="#" className="text-gami-muted hover:text-white text-sm transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
