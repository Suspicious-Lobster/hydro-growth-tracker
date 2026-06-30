import React, { useEffect, useRef } from 'react';
import { useAssistant } from '../../contexts/AssistantContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';

// A purely decorative, click-through layer of leaves in the corners that sway to
// make the whole app feel alive. Mounted once. Never blocks interaction
// (pointer-events-none) and self-disables when effects are off or the user
// prefers reduced motion.

const LEAF = 'M50 95 C30 70 30 30 50 5 C70 30 70 70 50 95 Z';

function DecoLeaf({ size, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} style={style} aria-hidden="true">
      <path d={LEAF} fill="currentColor" />
      <line x1="50" y1="92" x2="50" y2="12" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
    </svg>
  );
}

// Corner clusters: position + rotation + a stagger so the sway looks organic.
const CLUSTERS = [
  { pos: 'top-0 left-0', origin: 'origin-top-left', leaves: [{ s: 130, r: -20, d: '0s' }, { s: 90, r: 25, d: '1.5s' }] },
  { pos: 'top-0 right-0', origin: 'origin-top-right', leaves: [{ s: 120, r: 20, d: '0.8s' }, { s: 80, r: -25, d: '2.2s' }] },
  { pos: 'bottom-0 left-0', origin: 'origin-bottom-left', leaves: [{ s: 140, r: 18, d: '1.1s' }, { s: 95, r: -22, d: '0.4s' }] },
  { pos: 'bottom-0 right-0', origin: 'origin-bottom-right', leaves: [{ s: 110, r: -18, d: '1.9s' }] },
];

export default function AmbientLeaves() {
  const { effectsEnabled } = useAssistant();
  const reduced = useReducedMotion();
  const ref = useRef(null);
  const animate = effectsEnabled && !reduced;

  // Subtle mouse parallax via direct style mutation (no re-renders).
  useEffect(() => {
    if (!animate) return undefined;
    let raf = 0;
    const onMove = (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const x = (e.clientX / window.innerWidth - 0.5) * 14;
        const y = (e.clientY / window.innerHeight - 0.5) * 14;
        if (ref.current) ref.current.style.transform = `translate(${x}px, ${y}px)`;
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => { window.removeEventListener('pointermove', onMove); if (raf) cancelAnimationFrame(raf); };
  }, [animate]);

  if (!effectsEnabled) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden pointer-events-none" aria-hidden="true">
      <div ref={ref} className="absolute inset-0 text-green-500/20 dark:text-green-400/15">
        {CLUSTERS.map((c, ci) => (
          <div key={ci} className={`absolute ${c.pos}`}>
            {c.leaves.map((l, li) => (
              // Wrapper holds the static base rotation; the inner svg sways so the
              // animation's transform doesn't overwrite the rotation.
              <div key={li} className="absolute" style={{ transform: `rotate(${l.r}deg)` }}>
                <DecoLeaf
                  size={l.s}
                  className={`${c.origin} ${animate ? 'animate-bud-sway' : ''}`}
                  style={{ animationDelay: l.d }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
