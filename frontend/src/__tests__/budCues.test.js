// The cue table is a contract between brain and rig: every cue has a
// duration, an interrupt rule and a sound that is either null or a name the
// sound module will export; cueFor refuses unknown names.
import { describe, it, expect } from 'vitest';
import { CUES, CUE_NAMES, cueFor, BUD_EVENTS, BUD_EVENT_NAMES } from '../data/budCues';

describe('budCues contract', () => {
  it('every cue carries dur, interrupts and a sound slot', () => {
    expect(CUE_NAMES.length).toBeGreaterThanOrEqual(15);
    for (const name of CUE_NAMES) {
      const c = CUES[name];
      expect(typeof c.dur).toBe('number');
      expect(typeof c.interrupts).toBe('boolean');
      expect(c.sound === null || typeof c.sound === 'string').toBe(true);
    }
  });
  it('cueFor returns the record for a known cue and null otherwise', () => {
    expect(cueFor('nod')).toBe(CUES.nod);
    expect(cueFor('moonwalk')).toBeNull();
    expect(cueFor('toString')).toBeNull();
  });
  it('bus event names are unique strings', () => {
    expect(new Set(BUD_EVENT_NAMES).size).toBe(BUD_EVENT_NAMES.length);
    expect(BUD_EVENTS.SAVE_OK).toBe('save:ok');
  });
});
