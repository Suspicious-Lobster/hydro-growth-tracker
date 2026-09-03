import { defineConfig } from 'vitest/config';

// Root-level vitest: the embedded backend (server.js, db/**, validation.js).
// The frontend has its own vitest config under frontend/.
export default defineConfig({
  test: {
    include: ['test/**/*.test.mjs'],
    environment: 'node',
    // Every test spins up its own createServer() against a fresh temp dir, so
    // files are independent and may run in parallel.
    coverage: {
      provider: 'v8',
      include: ['server.js', 'db/**/*.js', 'validation.js'],
      reporter: ['text-summary', 'text'],
      // A floor set from the defect class, not from today's file: a route or
      // rule nobody exercises is where the next silent data-loss bug hides.
      thresholds: { lines: 90, statements: 90, functions: 90 },
    },
  },
});
