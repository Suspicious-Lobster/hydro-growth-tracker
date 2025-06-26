/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',                  //  ← NEW
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        hydro: { light: '#A7F3D0', DEFAULT: '#34D399', dark: '#059669' },
        brandGray: { DEFAULT: '#0F172A', light: '#1E293B' }
      }
    }
  },
  plugins: []
}
