import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const DRAG_THRESHOLD = 5; // px of movement before it counts as a drag, not a click

// Pointer-event dragging with no dependencies. Position is stored as offsets from
// the bottom-right corner ({ right, bottom } in px) so the element stays anchored
// and on-screen across window resizes. Commits to the caller only on drag-end to
// avoid persisting on every move.
//
//   const { position, handleProps, dragging, wasDragged } = useDraggable(initial, { size, onCommit });
//
// `wasDragged()` lets a click handler ignore the click that ends a drag.
//
// `follow` (MR-65) lets a caller (BudMascot, wandering) render the element at
// a position this hook didn't produce — e.g. mid-walk — without going
// through onCommit: pass the position to show while not dragging. It's read
// only while a drag isn't in progress, so it can never fight the user's hand.
export function useDraggable(initial, { size = { w: 72, h: 72 }, onCommit, follow } = {}) {
  const [position, setPosition] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const moved = useRef(false);
  const displayPosition = !dragging && follow ? follow : position;

  const bounds = useCallback(() => {
    const maxRight = Math.max(0, (window.innerWidth || 0) - size.w);
    const maxBottom = Math.max(0, (window.innerHeight || 0) - size.h);
    return { maxRight, maxBottom };
  }, [size.w, size.h]);

  const onPointerDown = useCallback((e) => {
    // Start from wherever the element is actually rendered right now (which
    // may be a `follow` position, mid-walk) so grabbing it never causes a jump.
    start.current = { x: e.clientX, y: e.clientY, right: displayPosition.right, bottom: displayPosition.bottom };
    moved.current = false;
    setPosition(displayPosition);
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not all targets support capture */ }
  }, [displayPosition]);

  const onPointerMove = useCallback((e) => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) moved.current = true;
    const { maxRight, maxBottom } = bounds();
    setPosition({
      right: clamp(start.current.right - dx, 0, maxRight),
      bottom: clamp(start.current.bottom - dy, 0, maxBottom),
    });
  }, [bounds]);

  const onPointerUp = useCallback((e) => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    setPosition((p) => { onCommit?.(p); return p; });
  }, [onCommit]);

  // Keep the element on-screen if the window shrinks.
  useEffect(() => {
    const onResize = () => {
      const { maxRight, maxBottom } = bounds();
      setPosition((p) => ({ right: clamp(p.right, 0, maxRight), bottom: clamp(p.bottom, 0, maxBottom) }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [bounds]);

  const wasDragged = useCallback(() => moved.current, []);

  return { position: displayPosition, handleProps: { onPointerDown, onPointerMove, onPointerUp }, dragging, wasDragged };
}
