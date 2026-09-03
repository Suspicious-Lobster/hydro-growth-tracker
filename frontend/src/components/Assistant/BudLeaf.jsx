import React from 'react';

// Bud — a chill, Towelie-style cannabis-leaf buddy. Flat South Park cutout look:
// chunky leaflets so the face reads on solid green, big googly eyes, noodle arms,
// little legs. The face changes with `expression`; whole-body animation is applied
// by the parent via `animate` (so it honors reduced-motion / the effects toggle).

const LEAF = '#3fa34d';
const OUTLINE = '#14532d';
const INK = '#111111';

const ANIM = {
  idle: 'animate-bud-bob',
  happy: 'animate-bud-bob',
  alert: 'animate-bud-pulse',
  celebrating: 'animate-bud-pop',
};

// The chunky 5-leaflet body + noodle arms + legs. Constant across expressions.
function Body() {
  return (
    <>
      {/* noodle arms */}
      <g stroke={OUTLINE} strokeWidth="3" fill="none" strokeLinecap="round">
        <path d="M38 84 Q20 86 18 70" />
        <path d="M82 84 Q100 88 102 74" />
      </g>
      <circle cx="18" cy="69" r="3.5" fill={LEAF} stroke={OUTLINE} strokeWidth="2" />
      <circle cx="102" cy="73" r="3.5" fill={LEAF} stroke={OUTLINE} strokeWidth="2" />
      {/* legs */}
      <g stroke={OUTLINE} strokeWidth="3" strokeLinecap="round">
        <path d="M53 106 L51 117" />
        <path d="M67 106 L69 117" />
      </g>
      {/* chunky leaf body */}
      <g fill={LEAF} stroke={OUTLINE} strokeWidth="2.5" strokeLinejoin="round">
        <g transform="translate(60 106)">
          <path d="M0 0 C-18 -30 -18 -62 0 -84 C18 -62 18 -30 0 0 Z" />
          <path d="M0 0 C-16 -26 -16 -54 0 -72 C16 -54 16 -26 0 0 Z" transform="rotate(32)" />
          <path d="M0 0 C-16 -26 -16 -54 0 -72 C16 -54 16 -26 0 0 Z" transform="rotate(-32)" />
          <path d="M0 0 C-13 -20 -13 -42 0 -56 C13 -42 13 -20 0 0 Z" transform="rotate(60)" />
          <path d="M0 0 C-13 -20 -13 -42 0 -56 C13 -42 13 -20 0 0 Z" transform="rotate(-60)" />
        </g>
      </g>
    </>
  );
}

// Two big googly eyes; helpers vary pupils / lids / mouth per mood.
function Eyes({ pupilY = 62, droopy = false, big = false }) {
  const ry = big ? 12.5 : 12;
  const rx = big ? 10.5 : 10;
  return (
    <g>
      <ellipse cx="53" cy="58" rx={rx} ry={ry} fill="#fff" stroke={INK} strokeWidth="1.5" />
      <ellipse cx="67" cy="58" rx={rx} ry={ry} fill="#fff" stroke={INK} strokeWidth="1.5" />
      <circle cx="53" cy={pupilY} r="3.1" fill={INK} />
      <circle cx="67" cy={pupilY} r="3.1" fill={INK} />
      {droopy && (
        <>
          <path d={`M43 53 A${rx} ${ry} 0 0 1 63 53 Z`} fill={LEAF} />
          <path d={`M57 53 A${rx} ${ry} 0 0 1 77 53 Z`} fill={LEAF} />
        </>
      )}
    </g>
  );
}

function Face({ expression }) {
  switch (expression) {
    case 'happy':
      return (
        <g>
          <Eyes pupilY={58} />
          <path d="M45 72 Q60 92 75 72" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
    case 'alert':
      // Attentive, goofy "heads-up" — wide googly eyes, raised brows, small o-mouth, tiny bead.
      return (
        <g>
          <path d="M44 44 q4 -2 8 -1 M76 44 q-4 -2 -8 -1" fill="none" stroke={OUTLINE} strokeWidth="1.6" strokeLinecap="round" />
          <Eyes pupilY={57} big />
          <ellipse cx="60" cy="79" rx="5.5" ry="6.5" fill={INK} />
          <path d="M88 60 q2.4 3.4 0 4.8 q-2.4 -1.4 0 -4.8 z" fill="#7dd3fc" />
        </g>
      );
    case 'celebrating':
      return (
        <g>
          <Eyes pupilY={55} />
          <path d="M44 72 Q60 96 76 72 Q60 84 44 72 Z" fill={INK} />
          <path d="M52 80 Q60 86 68 80" fill="#fb7185" />
          <path d="M30 40 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 z" fill="#fde047" />
          <path d="M92 46 l1.3 2.8 2.8 1.3 -2.8 1.3 -1.3 2.8 -1.3 -2.8 -2.8 -1.3 2.8 -1.3 z" fill="#fde047" />
        </g>
      );
    case 'idle':
    default:
      // Chill stoner vibe: droopy lids, low pupils, dopey grin.
      return (
        <g>
          <Eyes pupilY={62} droopy />
          <path d="M47 73 Q60 89 73 73" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );
  }
}

// Cues that get a static visual hint on the flat SVG fallback (for
// reduced-motion users who never see the animated 3D rig's cue performance).
// A tiny inline nudge per cue is enough — no animation needed here.
const CUE_HINT_STYLE = {
  nod: { transform: 'rotate(0deg)' },
  cheer: { transform: 'translateY(-4px)' },
  wince: { transform: 'rotate(-6deg)' },
  sulk: { transform: 'rotate(4deg) translateY(4px)' },
};

export default function BudLeaf({ expression = 'idle', animate = true, size = 72, cue = null }) {
  const animClass = animate ? (ANIM[expression] || ANIM.idle) : '';
  const cueName = cue?.name;
  const cueClass = CUE_HINT_STYLE[cueName] ? `bud-cue-${cueName}` : '';
  const cueStyle = CUE_HINT_STYLE[cueName] || undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 124"
      className={[animClass, cueClass].filter(Boolean).join(' ')}
      style={cueStyle}
      role="img"
      aria-label={`Bud the leaf, looking ${expression}`}
      data-cue={cueName || undefined}
    >
      <Body />
      <Face expression={expression} />
    </svg>
  );
}
