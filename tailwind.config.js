/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gami: {
          bg:      '#0E0E12',
          surface: '#16161E',
          border:  '#2A2A3A',
          purple:  '#6E3CFB',
          dark:    '#4B24B8',
          accent:  '#9C6CFF',
          green:   '#00F5A0',
          yellow:  '#F5C518',
          red:     '#FF4444',
          muted:   '#6B7280',
        },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        sans:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        brutal:          '8px 8px 0px 0px #000000',
        'brutal-purple': '8px 8px 0px 0px #6E3CFB',
        glow:            '0 0 20px rgba(110,60,251,0.4)',
        'glow-green':    '0 0 16px rgba(0,245,160,0.35)',
        'brutal-sm':     '4px 4px 0px 0px #000000',
      },
      animation: {
        float:       'float 6s ease-in-out infinite',
        'pulse-glow':'pulse-glow 4s ease-in-out infinite',
        'xp-tick':   'xp-tick 1.5s ease-out forwards',
        'slide-up':  'slide-up 0.6s ease-out forwards',
        marquee:     'marquee 30s linear infinite',
        'bounce-dot':'bounce-dot 1.4s ease-in-out infinite',
        'spin-slow': 'spin-slow 8s linear infinite',
      },
      keyframes: {
        float:       { '0%,100%': { transform: 'translateY(0) rotateY(0deg)' }, '50%': { transform: 'translateY(-20px) rotateY(180deg)' } },
        'pulse-glow':{ '0%,100%': { opacity: '0.5', filter: 'blur(40px)' }, '50%': { opacity: '0.8', filter: 'blur(60px)' } },
        'xp-tick':   { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.15)' } },
        'slide-up':  { from: { transform: 'translateY(24px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        marquee:     { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        'bounce-dot':{ '0%,80%,100%': { transform: 'scale(0)' }, '40%': { transform: 'scale(1)' } },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
      },
    },
  },
  plugins: [],
}
