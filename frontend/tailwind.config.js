/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark Theme Colors
        dark: {
          bg: '#0a0a0a',
          'bg-secondary': '#1a1a1a',
          'bg-accent': '#2a2a2a',
          text: '#f8fafc',
          'text-secondary': '#cbd5e1',
          'text-muted': '#94a3b8',
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
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
