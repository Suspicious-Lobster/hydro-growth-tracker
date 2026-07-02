import { describe, it, expect } from 'vitest';
import { setSoundEnabled, isSoundEnabled, pop, flick, snore } from '../utils/sound';

// jsdom has no AudioContext — the whole module must degrade to silent no-ops
// rather than throwing, whether sound is enabled or not.
describe('sound', () => {
  it('tracks the enabled flag', () => {
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });

  it('never throws when disabled', () => {
    setSoundEnabled(false);
    expect(() => { pop(); flick(); snore(); }).not.toThrow();
  });

  it('never throws when enabled but audio is unavailable (jsdom)', () => {
    setSoundEnabled(true);
    expect(() => { pop(); flick(); snore(); }).not.toThrow();
    setSoundEnabled(false);
  });
});
