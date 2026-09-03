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
export function useDraggable(initial, { size = { w: 72, h: 72 }, onCommit } = {}) {
  const [position, setPosition] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const moved = useRef(false);

  const bounds = useCallback(() => {
    const maxRight = Math.max(0, (window.innerWidth || 0) - size.w);
    const maxBottom = Math.max(0, (window.innerHeight || 0) - size.h);
    return { maxRight, maxBottom };
  }, [size.w, size.h]);

  const onPointerDown = useCallback((e) => {
    start.current = { x: e.clientX, y: e.clientY, right: position.right, bottom: position.bottom };
    moved.current = false;
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not all targets support capture */ }
  }, [position]);

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

  return { position, handleProps: { onPointerDown, onPointerMove, onPointerUp }, dragging, wasDragged };
}
