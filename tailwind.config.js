/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'gami-bg': '#0E0E12',
        'gami-surface': '#16161E',
        'gami-border': '#2A2A3A',
        'gami-purple': '#6E3CFB',
        'gami-dark': '#4B24B8',
        'gami-accent': '#9C6CFF',
        'gami-green': '#00F5A0',
        'gami-yellow': '#F5C518',
        'gami-red': '#FF4444',
        'gami-white': '#FFFFFF',
        'gami-muted': '#6B7280',
      },
      fontFamily: {
        'display': ['"Space Grotesk"', 'sans-serif'],
        'body': ['Inter', 'sans-serif'],
        'mono': ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'brutal': '8px 8px 0px 0px #000',
        'brutal-purple': '8px 8px 0px 0px #6E3CFB',
        'brutal-sm': '4px 4px 0px 0px #000',
        'brutal-green': '8px 8px 0px 0px #00F5A0',
      },
      borderRadius: {
        DEFAULT: '0px',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'xp-tick': {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'count-up': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'bounce-dot': {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delay': 'float 6s ease-in-out infinite 2s',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        'xp-tick': 'xp-tick 1.5s ease-out forwards',
        'slide-up': 'slide-up 0.6s ease-out forwards',
        'marquee': 'marquee 30s linear infinite',
        'bounce-dot': 'bounce-dot 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
