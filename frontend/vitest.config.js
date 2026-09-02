import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Extends the app's vite config so tests build with the same plugins/aliases,
// then layers on the jsdom environment component tests need (DOM APIs like
// document/window) plus the jest-dom matcher setup.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.js'],
    },
  })
);
