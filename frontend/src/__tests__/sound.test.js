import { describe, it, expect } from 'vitest';
import {
  setSoundEnabled, isSoundEnabled, pop, flick, snore,
  huh, hum, chomp, yawn, steps, giggle, SOUNDS, playCue,
} from '../utils/sound';
import { CUES } from '../data/budCues';

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
    expect(() => {
      pop(); flick(); snore(); huh(); hum(); chomp(); yawn(); steps(); giggle();
    }).not.toThrow();
  });

  it('never throws when enabled but audio is unavailable (jsdom)', () => {
    setSoundEnabled(true);
    expect(() => {
      pop(); flick(); snore(); huh(); hum(); chomp(); yawn(); steps(); giggle();
    }).not.toThrow();
    setSoundEnabled(false);
  });

  it('resolves every sound named in a CUES slot to a SOUNDS function', () => {
    const names = new Set(
      Object.values(CUES).map((cue) => cue.sound).filter((sound) => sound != null),
    );
    expect(names.size).toBeGreaterThan(0);
    for (const sound of names) {
      expect(typeof SOUNDS[sound]).toBe('function');
    }
  });

  it('playCue is a no-op for null/unknown names and never throws', () => {
    setSoundEnabled(false);
    expect(() => { playCue(null); playCue(undefined); playCue('nope'); }).not.toThrow();
  });

  it('playCue plays the named sound when enabled with a stub AudioContext', () => {
    class FakeParam {
      setValueAtTime() { return this; }
      exponentialRampToValueAtTime() { return this; }
    }
    class FakeNode {
      connect() { return this; }
      start() {}
      stop() {}
    }
    class FakeOsc extends FakeNode {
      constructor() {
        super();
        this.frequency = new FakeParam();
      }
    }
    class FakeGain extends FakeNode {
      constructor() {
        super();
        this.gain = new FakeParam();
      }
    }
    let oscCount = 0;
    class FakeAudioContext {
      constructor() {
        this.state = 'running';
        this.currentTime = 0;
        this.destination = {};
      }

      createOscillator() {
        oscCount += 1;
        return new FakeOsc();
      }

      createGain() {
        return new FakeGain();
      }
    }
    const originalAC = window.AudioContext;
    window.AudioContext = FakeAudioContext;
    setSoundEnabled(true);
    for (const name of ['huh', 'hum', 'chomp', 'yawn', 'steps', 'giggle']) {
      oscCount = 0;
      playCue(name);
      expect(oscCount).toBeGreaterThan(0);
    }
    setSoundEnabled(false);
    oscCount = 0;
    playCue('huh');
    expect(oscCount).toBe(0);
    window.AudioContext = originalAC;
  });
});
