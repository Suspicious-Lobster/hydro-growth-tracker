import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base: './'` keeps asset paths relative so the build works when loaded from
// the file:// protocol inside the packaged Electron app.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy vendor libraries into their own chunks so the main
        // bundle stays small and the charting code can load independently.
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['recharts'],
          // three.js is heavy and only needed for the 3D Lush mascot, which is
          // lazy-loaded. Keep it in its own chunk, out of the entry bundle.
          three: ['three'],
        },
      },
    },
  },
})
