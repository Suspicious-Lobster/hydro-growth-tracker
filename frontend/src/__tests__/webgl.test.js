import { describe, it, expect, afterEach, vi } from 'vitest';
import { detectWebGL, __resetWebGLCache } from '../utils/webgl';

// detectWebGL drives BudRenderer's choice between the 3D Lush mascot and the static
// SVG fallback. These tests run under vitest's node environment (no DOM), so we mock
// `document` to exercise each branch. The cache is reset between cases.

const withDocument = (doc, fn) => {
  const had = 'document' in globalThis;
  const prev = globalThis.document;
  globalThis.document = doc;
  try {
    __resetWebGLCache();
    fn();
  } finally {
    if (had) globalThis.document = prev;
    else delete globalThis.document;
    __resetWebGLCache();
  }
};

afterEach(() => __resetWebGLCache());

describe('detectWebGL', () => {
  it('returns false when there is no DOM (node/SSR)', () => {
    // document is not defined in the node test environment
    expect(detectWebGL()).toBe(false);
  });

  it('returns true when a canvas yields a usable WebGL context', () => {
    const gl = { getParameter: () => 1 };
    const doc = { createElement: () => ({ getContext: () => gl }) };
    withDocument(doc, () => expect(detectWebGL()).toBe(true));
  });

  it('returns false when getContext yields nothing', () => {
    const doc = { createElement: () => ({ getContext: () => null }) };
    withDocument(doc, () => expect(detectWebGL()).toBe(false));
  });

  it('returns false when the context lacks getParameter', () => {
    const doc = { createElement: () => ({ getContext: () => ({}) }) };
    withDocument(doc, () => expect(detectWebGL()).toBe(false));
  });

  it('returns false when getContext throws', () => {
    const doc = { createElement: () => ({ getContext: () => { throw new Error('blocked'); } }) };
    withDocument(doc, () => expect(detectWebGL()).toBe(false));
  });

  it('memoizes the first result', () => {
    const getContext = vi.fn(() => ({ getParameter: () => 1 }));
    const doc = { createElement: () => ({ getContext }) };
    withDocument(doc, () => {
      expect(detectWebGL()).toBe(true);
      expect(detectWebGL()).toBe(true);
      expect(getContext).toHaveBeenCalledTimes(1);
    });
  });
});
