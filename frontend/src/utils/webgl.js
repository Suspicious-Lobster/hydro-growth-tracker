// Cheap, side-effect-free check for usable WebGL. Used by BudRenderer to decide
// whether to spin up the 3D Lush mascot or fall back to the static SVG Bud.
// Defensive about non-DOM/SSR and browsers that throw on getContext.

let cached;

export function detectWebGL() {
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    cached = false;
    return cached;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    cached = Boolean(gl && typeof gl.getParameter === 'function');
  } catch {
    cached = false;
  }
  return cached;
}

// Test-only: clear the memoized result so a mocked environment can be re-probed.
export function __resetWebGLCache() {
  cached = undefined;
}
