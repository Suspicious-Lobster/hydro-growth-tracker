import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const CSP_CONTENT = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://127.0.0.1:*; connect-src 'self' http://127.0.0.1:*; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'"

// MR-15: inject a strict Content-Security-Policy meta tag into the production
// build only. The dev server (Vite HMR) injects inline scripts for React Fast
// Refresh, so a strict CSP there would break development.
function cspPlugin() {
  let isBuild = false
  return {
    name: 'inject-csp',
    configResolved(c) {
      isBuild = c.command === 'build'
    },
    transformIndexHtml(html) {
      if (!isBuild) return html
      return html.replace(
        '</head>',
        `    <meta http-equiv="Content-Security-Policy" content="${CSP_CONTENT}">\n  </head>`
      )
    },
  }
}

// `base: './'` keeps asset paths relative so the build works when loaded from
// the file:// protocol inside the packaged Electron app.
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
  resolve: {
    alias: {
      // MR-33: the frontend imports the server's validation.js directly so
      // there is exactly one derivation of each rule/bound (CODING-PRACTICES
      // 5.4), instead of a hand-rolled re-implementation drifting from it.
      '@shared/validation': path.resolve(__dirname, '../validation.js'),
    },
  },
  server: {
    fs: {
      // Allow the dev server to serve validation.js from outside frontend/.
      allow: ['..'],
    },
  },
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
