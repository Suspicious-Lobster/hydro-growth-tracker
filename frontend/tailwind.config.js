/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        // Bud the mascot idling: a slow, gentle vertical bob.
        'bud-bob': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        // Alert state: a subtle attention-grabbing pulse.
        'bud-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
        // Celebrate: a one-shot springy pop.
        'bud-pop': {
          '0%': { transform: 'scale(0.7) rotate(-8deg)' },
          '60%': { transform: 'scale(1.15) rotate(4deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)' },
        },
        // Ambient leaves: a lazy sway.
        'bud-sway': {
          '0%, 100%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(4deg)' },
        },
        // Speech bubble entrance.
        'bud-rise': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'bud-bob': 'bud-bob 3.5s ease-in-out infinite',
        'bud-pulse': 'bud-pulse 1.1s ease-in-out infinite',
        'bud-pop': 'bud-pop 0.5s ease-out',
        'bud-sway': 'bud-sway 7s ease-in-out infinite',
        'bud-rise': 'bud-rise 0.25s ease-out',
      },
      colors: {
        // Dark Theme Colors
        dark: {
          bg: '#0a0a0a',
          'bg-secondary': '#1a1a1a',
          'bg-accent': '#2a2a2a',
          text: '#f8fafc',
          'text-secondary': '#cbd5e1',
          'text-muted': '#94a3b8',
          // One blue cannot serve as both text on near-black and a fill under
          // white text at WCAG AA (MR-28, axe): as TEXT it must be light
          // (blue-400 #60a5fa on #1a1a1a is 6.5:1), as a FILL it must be dark
          // (white on blue-600 #2563eb is 5.2:1; on blue-500 it was 3.7:1).
          primary: '#60a5fa',
          'primary-bg': '#2563eb',
          'primary-hover': '#1d4ed8',
          secondary: '#06b6d4',
          accent: '#8b5cf6',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
          border: '#374151',
        },
        // Light Theme Colors  
        light: {
          bg: '#ffffff',
          'bg-secondary': '#f8fafc',
          'bg-accent': '#f1f5f9',
          text: '#1e293b',
          'text-secondary': '#475569',
          'text-muted': '#64748b',
          primary: '#2563eb',
          'primary-bg': '#2563eb',
          'primary-hover': '#1d4ed8',
          secondary: '#0891b2',
          accent: '#7c3aed',
          success: '#059669',
          warning: '#d97706',
          error: '#dc2626',
          border: '#e2e8f0',
        }
      }
    },
  },
  plugins: [],
}
