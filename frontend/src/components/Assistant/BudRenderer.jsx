import React, { Suspense, lazy, useMemo } from 'react';
import BudLeaf from './BudLeaf';
import { detectWebGL } from '../../utils/webgl';

// Picks how to draw Bud. When motion is allowed (effects on AND not reduced-motion,
// passed in as `animate`) and the browser has usable WebGL, render the 3D "Lush"
// character — lazily, so three.js stays in its own chunk and out of the entry bundle.
// Otherwise (or while the 3D chunk is still loading) fall back to the static SVG Bud.
// The decision lives here so BudMascot stays focused on the assistant brain, and so
// the SVG-vs-3D choice is trivially unit-testable.

const BudThree = lazy(() => import('./BudThree'));

export default function BudRenderer({ expression = 'idle', animate = true, size = 108, dragging = false, talking = false, mood = 'neutral' }) {
  const use3D = useMemo(() => animate && detectWebGL(), [animate]);

  if (!use3D) {
    return <BudLeaf expression={expression} animate={animate} size={size} />;
  }

  return (
    <Suspense fallback={<BudLeaf expression={expression} animate={animate} size={size} />}>
      <BudThree expression={expression} size={size} dragging={dragging} talking={talking} mood={mood} />
    </Suspense>
  );
}
