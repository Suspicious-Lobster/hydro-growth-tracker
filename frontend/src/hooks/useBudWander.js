import { useCallback, useEffect, useRef, useState } from 'react';

// MR-65: animates Bud's position toward a spot beside whatever the user is
// looking at (an alert, a focused form) and walks him home again after a
// stretch of nothing happening. Position stays in useDraggable's
// { right, bottom } (anchored-to-corner) coordinate system throughout, so
// BudMascot can hand this straight to the same style prop it already uses —
// wandering never calls useDraggable's onCommit, so it can never overwrite
// the user's saved corner.

const SPEED_PX_S = 380; // walking speed
const IDLE_MS = 12000; // walk home after this long with no new target
const MARGIN = 16; // stay this far inside the viewport edge
const GAP = 8; // px between Bud and the target he's beside

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// Ease-in-out (quadratic): slow start, fast middle, slow finish.
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);

// Do two axis-aligned boxes ({left, top, right, bottom}) overlap? Strict
// (touching edges don't count) — this is the red-proof site (MR-65): remove
// this check from placeBeside below and a target with no room on its
// preferred side gets covered instead of avoided.
const rectsIntersect = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// Convert a { right, bottom } corner-offset position to a { left, top, right,
// bottom } box (and back) for placement maths — useDraggable's coordinate
// system anchors to the bottom-right corner so the mascot stays on-screen
// across resizes; placement is easiest to reason about in plain viewport
// left/top boxes.
const toBox = (pos, size, vw, vh) => {
  const left = vw - pos.right - size.w;
  const top = vh - pos.bottom - size.h;
  return { left, top, right: left + size.w, bottom: top + size.h };
};
const toPos = (box, size, vw, vh) => ({ right: vw - box.left - size.w, bottom: vh - box.top - size.h });

// One candidate placement on a given side of `rect`, clamped fully inside
// the viewport (MARGIN in from every edge). Clamping can push a candidate
// back toward the rect when there isn't room on that side — that's why
// placeBeside below still has to check the result for overlap rather than
// trusting the offset alone.
function candidateFor(dir, rect, size, vw, vh) {
  const midY = clamp(rect.top + (rect.bottom - rect.top) / 2 - size.h / 2, MARGIN, vh - MARGIN - size.h);
  const midX = clamp(rect.left + (rect.right - rect.left) / 2 - size.w / 2, MARGIN, vw - MARGIN - size.w);
  let left;
  let top;
  if (dir === 'left') { left = rect.left - size.w - GAP; top = midY; }
  else if (dir === 'right') { left = rect.right + GAP; top = midY; }
  else if (dir === 'above') { left = midX; top = rect.top - size.h - GAP; }
  else { left = midX; top = rect.bottom + GAP; }
  left = clamp(left, MARGIN, vw - MARGIN - size.w);
  top = clamp(top, MARGIN, vh - MARGIN - size.h);
  return { dir, box: { left, top, right: left + size.w, bottom: top + size.h } };
}

// Try left of the rect, then right, then above, then below; the first whose
// clamped box doesn't intersect the rect wins. If none avoid it (the target
// fills the viewport), fall back to the first candidate rather than getting
// stuck — keeping Bud on-screen matters more than a guarantee that can't be
// met.
function placeBeside(rect, size, vw, vh) {
  let fallback = null;
  for (const dir of ['left', 'right', 'above', 'below']) {
    const c = candidateFor(dir, rect, size, vw, vh);
    if (!fallback) fallback = c;
    if (!rectsIntersect(c.box, rect)) return c;
  }
  return fallback;
}

// useBudWander({ home, size, enabled, blocked, onCue, now, raf })
//   -> { position, goTo(rect | null, { point }), goHome() }
//
// `home` is the user's saved corner ({ right, bottom }, same shape/system as
// useDraggable's position). `blocked` stops goTo from starting a new walk
// (dragging / minimized / a bubble open / the tour running) but doesn't
// interrupt one already running — the caller simply stops asking for new
// targets while blocked. `now`/`raf` default to performance.now /
// requestAnimationFrame and are injectable so tests can drive the animation
// with fake timers and manually-fired frames.
export function useBudWander({ home, size = { w: 72, h: 72 }, enabled = true, blocked = false, onCue, now, raf } = {}) {
  // Kept in refs (not deps) so a caller passing a fresh inline `now`/`raf`
  // function on every render doesn't force `animate` below to be rebuilt.
  const getNowRef = useRef(now || (() => performance.now()));
  getNowRef.current = now || (() => performance.now());
  const scheduleRef = useRef(raf || ((cb) => requestAnimationFrame(cb)));
  scheduleRef.current = raf || ((cb) => requestAnimationFrame(cb));

  const [position, setPositionState] = useState(home);
  const posRef = useRef(home);
  const homeRef = useRef(home);
  homeRef.current = home;

  // Bumped on every goTo/goHome so an in-flight rAF loop from a superseded
  // move recognizes it's stale and stops applying frames.
  const genRef = useRef(0);
  const idleTimerRef = useRef(null);

  const clearIdle = useCallback(() => {
    if (idleTimerRef.current != null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearIdle(), [clearIdle]);

  // Walks from the current position to `destBox` (a viewport left/top/right/
  // bottom box), calling `arrival` once the motion completes. Fires the
  // 'walk' cue at the start (skipped if already there) so the rig's looping
  // walk animation only plays while position is actually changing.
  const animate = useCallback((destBox, arrival) => {
    genRef.current += 1;
    const myGen = genRef.current;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const startBox = toBox(posRef.current, size, vw, vh);
    const dx = destBox.left - startBox.left;
    const dy = destBox.top - startBox.top;
    const dist = Math.hypot(dx, dy);

    const settle = (box) => {
      const p = toPos(box, size, window.innerWidth, window.innerHeight);
      posRef.current = p;
      setPositionState(p);
    };

    if (dist < 1) {
      settle(destBox);
      arrival?.();
      return;
    }

    const durationMs = (dist / SPEED_PX_S) * 1000;
    const startTime = getNowRef.current();
    onCue?.('walk');

    const step = () => {
      if (genRef.current !== myGen) return; // a newer move took over
      const t = Math.min(1, (getNowRef.current() - startTime) / durationMs);
      const e = ease(t);
      const curLeft = startBox.left + dx * e;
      const curTop = startBox.top + dy * e;
      settle({ left: curLeft, top: curTop, right: curLeft + size.w, bottom: curTop + size.h });
      if (t < 1) { scheduleRef.current(step); return; }
      arrival?.();
    };
    scheduleRef.current(step);
  }, [size, onCue]);

  // goHome is defined after animate but referenced (via this ref) from
  // inside the idle timer's callback and from goTo's arrival, so both always
  // call the latest version without a circular useCallback dependency.
  const goHomeRef = useRef();

  const armIdleTimer = useCallback(() => {
    clearIdle();
    idleTimerRef.current = setTimeout(() => { goHomeRef.current(); }, IDLE_MS);
  }, [clearIdle]);

  const goHome = useCallback(() => {
    clearIdle();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const destBox = toBox(homeRef.current, size, vw, vh);
    animate(destBox, () => { onCue?.('land'); });
  }, [animate, size, onCue, clearIdle]);
  goHomeRef.current = goHome;

  const goTo = useCallback((rect, { point = false } = {}) => {
    if (!enabled || blocked || !rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const { box, dir } = placeBeside(rect, size, vw, vh);
    animate(box, () => {
      onCue?.('land');
      if (point) onCue?.('point', { dir });
      armIdleTimer();
    });
  }, [enabled, blocked, size, animate, onCue, armIdleTimer]);

  return { position, goTo, goHome };
}
