// MR-62: budBus is the plumbing between "the app did something" and "Bud
// reacts". Proves subscribe/emit/unsubscribe, the unknown-event guard, and
// the '*' wildcard.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emit, emitSafe, subscribe, _reset } from '../utils/budBus';
import { BUD_EVENTS } from '../data/budCues';

describe('budBus (MR-62)', () => {
  beforeEach(() => {
    _reset();
  });

  it('delivers an emitted event to a subscriber (round trip)', () => {
    const fn = vi.fn();
    subscribe(BUD_EVENTS.SAVE_OK, fn);
    emit(BUD_EVENTS.SAVE_OK, { kind: 'log' });
    expect(fn).toHaveBeenCalledWith({ kind: 'log' }, BUD_EVENTS.SAVE_OK);
  });

  it('unsubscribe stops delivery', () => {
    const fn = vi.fn();
    const unsubscribe = subscribe(BUD_EVENTS.SAVE_OK, fn);
    unsubscribe();
    emit(BUD_EVENTS.SAVE_OK, { kind: 'log' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('throws on an unknown event type', () => {
    expect(() => emit('not:a:real:event', {})).toThrow(/unknown event/);
  });

  it('emitSafe swallows the unknown-event error instead of throwing', () => {
    expect(() => emitSafe('not:a:real:event', {})).not.toThrow();
  });

  it("a '*' subscriber receives every event", () => {
    const fn = vi.fn();
    subscribe('*', fn);
    emit(BUD_EVENTS.SAVE_OK, { kind: 'log' });
    emit(BUD_EVENTS.DELETE, { kind: 'plant' });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, { kind: 'log' }, BUD_EVENTS.SAVE_OK);
    expect(fn).toHaveBeenNthCalledWith(2, { kind: 'plant' }, BUD_EVENTS.DELETE);
  });

  it('a listener that throws does not prevent other listeners from being called', () => {
    const bad = vi.fn(() => { throw new Error('boom'); });
    const good = vi.fn();
    subscribe(BUD_EVENTS.SAVE_OK, bad);
    subscribe(BUD_EVENTS.SAVE_OK, good);
    expect(() => emit(BUD_EVENTS.SAVE_OK, {})).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});
