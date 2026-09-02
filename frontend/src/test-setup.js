// Global test setup for component tests: adds jest-dom's DOM matchers
// (e.g. toBeInTheDocument, toHaveTextContent) to vitest's `expect`.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Without `test.globals: true` in vitest.config.js, @testing-library/react's
// auto-cleanup (which hooks into a global `afterEach`) never registers, so
// each test's render stays mounted into the next test's document and
// getByTestId starts matching stale elements from a prior test.
afterEach(() => {
  cleanup();
});
