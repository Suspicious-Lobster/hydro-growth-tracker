// MR-65: useBudWander animates Bud's { right, bottom } position toward a spot
// beside a target rect (never covering it), walks home after 12s of nothing,
// and never starts a move while disabled/blocked. `raf` and `now` are
// injected so the animation is driven by hand — no real timers, no DOM
// measurement inside the hook itself.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBudWander } from '../hooks/useBudWander';

const VW = 1280;
const VH = 800;
const SIZE = { w: 72, h: 72 };

// Box the mascot currently occupies, in the same {left,top,right,bottom}
// terms as the target rects below.
const boxOf = (position) => {
  const left = VW - position.right - SIZE.w;
  const top = VH - position.bottom - SIZE.h;
  return { left, top, right: left + SIZE.w, bottom: top + SIZE.h };
};
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// A manually-driven requestAnimationFrame stand-in: `raf` captures the next
// callback; `step()` runs it once (advancing the injected clock first) and
// reports whether a frame actually ran, so a caller can drive the animation
// one frame at a time.
function makeHarness() {
  const clock = { now: 0 };
  let pending = null;
  const raf = (cb) => { pending = cb; return 1; };
  const now = () => clock.now;
  const hasPending = () => pending != null;
  const step = (msPerFrame = 16) => {
    if (!pending) return false;
    const cb = pending;
    pending = null;
    clock.now += msPerFrame;
    cb();
    return true;
  };
  return { raf, now, hasPending, step };
}

// Runs every scheduled frame to completion, each in its own `act()` so React
// actually commits the resulting state before the next frame (and before
// `onFrame` samples it) — a single `act()` around the whole loop would let
// React 18 batch every intermediate setState away, silently sampling only
// the last committed value on every call.
function runToCompletion(harness, msPerFrame, onFrame) {
  let n = 0;
  while (harness.hasPending() && n < 10000) {
    act(() => { harness.step(msPerFrame); });
    onFrame?.();
    n += 1;
  }
  return n;
}

describe('useBudWander (MR-65)', () => {
  beforeEach(() => {
    vi.stubGlobal('innerWidth', VW);
    vi.stubGlobal('innerHeight', VH);
    vi.useFakeTimers();
  });

  it('walks to a spot left of a target rect on the right edge and never overlaps it (any frame)', () => {
    const harness = makeHarness();
    const home = { right: 1008, bottom: 128 }; // box (200,600,272,672) — well left of the target
    const onCue = vi.fn();
    const { result } = renderHook(() => useBudWander({
      home, size: SIZE, enabled: true, blocked: false, onCue, now: harness.now, raf: harness.raf,
    }));

    const targetRect = { left: 1100, top: 300, right: 1250, bottom: 450 };
    act(() => { result.current.goTo(targetRect); });
    expect(onCue).toHaveBeenCalledWith('walk');

    // Sample every single frame (small steps -> many samples), not just the
    // final resting spot.
    const frames = [];
    const frameCount = runToCompletion(harness, 1, () => frames.push(boxOf(result.current.position)));
    expect(frameCount).toBeGreaterThan(5);
    expect(frames.every((box) => !overlaps(box, targetRect))).toBe(true);
    expect(frames[frames.length - 1].right).toBeLessThanOrEqual(targetRect.left); // placed to the LEFT of it
    expect(onCue).toHaveBeenCalledWith('land');
  });

  it("clamping toward a target with no room on its preferred side still never overlaps it (red-proof site: placeBeside's overlap check)", () => {
    const harness = makeHarness();
    // Home sits well clear to the right of this target so the straight-line
    // path never dips into it either.
    const home = { right: 308, bottom: 228 }; // box (900,500,972,572)
    const onCue = vi.fn();
    const { result } = renderHook(() => useBudWander({
      home, size: SIZE, enabled: true, blocked: false, onCue, now: harness.now, raf: harness.raf,
    }));

    // Hard against the left edge: "left of it" would need to be clamped back
    // toward the target — this is what exercises the overlap check.
    const targetRect = { left: 20, top: 300, right: 200, bottom: 400 };
    act(() => { result.current.goTo(targetRect); });

    const frames = [];
    const frameCount = runToCompletion(harness, 4, () => frames.push(boxOf(result.current.position)));
    expect(frameCount).toBeGreaterThan(1);
    expect(frames.every((box) => !overlaps(box, targetRect))).toBe(true);
    const finalBox = frames[frames.length - 1];
    expect(finalBox.left).toBeGreaterThanOrEqual(targetRect.right); // fell back to the RIGHT side
  });

  it('returns to the home position after 12s of no new target', () => {
    const harness = makeHarness();
    const home = { right: 1008, bottom: 128 };
    const onCue = vi.fn();
    const { result } = renderHook(() => useBudWander({
      home, size: SIZE, enabled: true, blocked: false, onCue, now: harness.now, raf: harness.raf,
    }));

    const targetRect = { left: 1100, top: 300, right: 1250, bottom: 450 };
    act(() => { result.current.goTo(targetRect); });
    runToCompletion(harness, 16); // arrive; arms the 12s idle timer

    expect(result.current.position).not.toEqual(home);

    act(() => { vi.advanceTimersByTime(12000); }); // fires goHome()
    runToCompletion(harness, 16); // walk all the way back

    expect(result.current.position).toEqual(home);
    expect(onCue).toHaveBeenCalledWith('land');
  });

  it('wanderEnabled=false: goTo never moves position', () => {
    const harness = makeHarness();
    const home = { right: 1008, bottom: 128 };
    const onCue = vi.fn();
    const { result } = renderHook(() => useBudWander({
      home, size: SIZE, enabled: false, blocked: false, onCue, now: harness.now, raf: harness.raf,
    }));

    const targetRect = { left: 1100, top: 300, right: 1250, bottom: 450 };
    act(() => { result.current.goTo(targetRect); });
    runToCompletion(harness, 16);

    expect(result.current.position).toEqual(home);
    expect(onCue).not.toHaveBeenCalledWith('walk');
  });

  it('a drag in progress (blocked=true): goTo never moves position', () => {
    const harness = makeHarness();
    const home = { right: 1008, bottom: 128 };
    const onCue = vi.fn();
    const { result } = renderHook(() => useBudWander({
      home, size: SIZE, enabled: true, blocked: true, onCue, now: harness.now, raf: harness.raf,
    }));

    const targetRect = { left: 1100, top: 300, right: 1250, bottom: 450 };
    act(() => { result.current.goTo(targetRect); });
    runToCompletion(harness, 16);

    expect(result.current.position).toEqual(home);
    expect(onCue).not.toHaveBeenCalledWith('walk');
  });
});
