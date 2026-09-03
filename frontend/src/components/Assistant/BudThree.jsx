import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  buildLush, ARM_REST, ARM_SMOKE, ARM_WAVE, ARM_STRETCH,
  ARM_CHEER, ARM_SHRUG, ARM_FACEPALM, ARM_POINT, ARM_SCRATCH, ARM_WATCH, BLOODSHOT,
} from './lush/buildLush';
import { flick, snore, playCue } from '../../utils/sound';
import { CUES, cueFor } from '../../data/budCues';

// The living, 3D incarnation of Bud ("Lush"). Boots a tiny three.js scene, builds
// the procedural leaf character, and runs one rAF loop that drives the four "alive"
// behaviours: cursor lean + eye-gaze, blink + breathe, dynamic ground shadow, and a
// grab/drag squash reaction — plus an occasional idle "spark up a smoke" emote where
// Bud raises the joint to his mouth, lights it, and puffs. Lazy-loaded by BudRenderer,
// so three.js never lands in the entry chunk. Fully tears down (geometries, materials,
// textures, renderer, listeners, rAF) on unmount.
//
// This file is intentionally not unit-tested — jsdom has no WebGL. It's verified
// live in the browser; the SVG fallback path (BudRenderer) carries the unit tests.

const lerp = (a, b, t) => a + (b - a) * t;

// Per-expression pose targets the loop eases toward.
const POSES = {
  idle:        { lidOpen: 0.55, browLift: 0.0,  gazeY: -0.25, breathe: 0.9,  bounce: 0 },
  happy:       { lidOpen: 0.85, browLift: 0.05, gazeY: 0.12,  breathe: 1.25, bounce: 0 },
  alert:       { lidOpen: 1.0,  browLift: 0.2,  gazeY: 0.18,  breathe: 1.7,  bounce: 0 },
  celebrating: { lidOpen: 0.92, browLift: 0.12, gazeY: 0.22,  breathe: 1.9,  bounce: 1 },
};

// Resting mouth per expression: { open: jaw drop, wide: smile width }.
const MOUTH_BASE = {
  idle:        { open: 0.04, wide: 0.6 },
  happy:       { open: 0.12, wide: 0.95 },
  alert:       { open: 0.6,  wide: 0.4 },
  celebrating: { open: 0.55, wide: 1.0 },
};

// Idle emote timing (seconds): the smoke bit runs raise→spark→puff→lower; the
// single-phase emotes (wave / stretch / groove / munch / lookAround / scratch /
// hum / watch) just run for their duration. The new bits' durations are pulled
// straight from CUES so there's one source of truth for "how long is this".
// The smoke point is where the plume rises from (near Bud's mouth). Emotes only fire
// while he's idle and undisturbed.
const EMOTE = {
  raise: 1.0, spark: 1.4, puff: 2.4, wave: 2.4, stretch: 2.6, groove: 3.4, munch: 3.2,
  lookAround: CUES.lookAround.dur, scratch: CUES.scratch.dur, hum: CUES.hum.dur, watch: CUES.watch.dur,
  cooldown: 8,
};
// Base pick weights for the idle emote roulette (MR-68), keyed by emote kind (note
// the internal kind names 'munch'/'stretch' are the snack/yawn bits — CUES calls
// them 'munchies'/'yawn'). pickEmote multiplies munch 3x at noon (11:30-13:30) and
// late night (22:00-01:00), and stretch 3x after 21:00, using a decimal hour so the
// minute matters at the window edges.
const EMOTE_WEIGHTS = {
  wave: 22, smoke: 28, stretch: 18, groove: 17, munch: 16, lookAround: 14, scratch: 10, hum: 12, watch: 8,
};
// Maps an emote kind to the CUES entry that names its start-of-bit sound (only
// entries that actually play one — lookAround/scratch/watch/wave/groove/smoke
// don't, per the design notes).
const EMOTE_SOUND_CUE = { munch: 'munchies', stretch: 'yawn', hum: 'hum' };

// Sample one idle emote kind, weighted for the time of day. `hour` is a decimal
// (e.g. 11.5 = 11:30) and `rand` is a fresh Math.random() value in [0, 1) passed
// in by the caller so this stays pure and testable (window.__bud.pickEmote).
const pickEmote = (hour, rand) => {
  const weights = { ...EMOTE_WEIGHTS };
  const noon = hour >= 11.5 && hour < 13.5;
  const lateNight = hour >= 22 || hour < 1;
  if (noon || lateNight) weights.munch *= 3;
  if (hour >= 21) weights.stretch *= 3;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const roll = rand * total;
  let cumulative = 0;
  const names = Object.keys(weights);
  for (const name of names) {
    cumulative += weights[name];
    if (roll < cumulative) return name;
  }
  return names[0];
};
const SMOKE_EMIT = { x: 0.26, y: 0.0, z: 0.97 };
const COUGH_EMIT = { x: 0.05, y: -0.05, z: 0.78 }; // from the mouth, when he coughs
const SLEEP_AFTER = 28; // seconds of stillness before Bud dozes off

// Time-of-day awareness: at night he's heavy-lidded, breathes slower, and dozes off
// sooner; in the morning he's a touch perkier. Returns multipliers the loop applies.
const dayMood = (hour) => {
  if (hour >= 22 || hour < 6) return { lid: 0.8, breathe: 0.85, sleepAfter: 0.5 }; // night owl
  if (hour < 11) return { lid: 1.05, breathe: 1.15, sleepAfter: 1.2 };             // morning person
  return { lid: 1, breathe: 1, sleepAfter: 1 };
};

// Bloodshot ramps from this resting amount up to MAX while he smokes, then fades.
const VEIN_REST = 0.55 * BLOODSHOT;
const VEIN_MAX = 0.95;
// Sclera tints from near-white toward pink as the eyes redden.
const SCLERA_CLEAR = { r: 0.984, g: 0.984, b: 0.957 };
const SCLERA_RED = { r: 0.95, g: 0.66, b: 0.62 };

// Ease one arm's shoulder pivot from its rest pose toward its smoke pose (t = 0..1).
const applyArmPose = (pivot, rest, smoke, t) => {
  pivot.rotation.x = lerp(rest.x, smoke.x, t);
  pivot.rotation.y = lerp(rest.y, smoke.y, t);
  pivot.rotation.z = lerp(rest.z, smoke.z, t);
};

// Mirror an ARM_POINT-style pose to the opposite side (payload.dir === -1):
// keep the pitch (x), flip the yaw/swing (y, z) that aim it left vs right.
const mirrorArmX = (p) => ({ x: p.x, y: -p.y, z: -p.z });

// Ease a one-shot reaction cue in/out over its own duration (u = t/dur, 0..1):
// ramp up over the first 20%, hold at full strength, ease back down over the
// last 25% so every cue always lands back on rest before `dur` elapses.
const smoothstep = (x) => x * x * (3 - 2 * x);
const cueEnvelope = (u) => {
  if (u <= 0.2) return smoothstep(u / 0.2);
  if (u >= 0.75) return smoothstep(Math.max(0, (1 - u) / 0.25));
  return 1;
};

export default function BudThree({ expression = 'idle', size = 108, dragging = false, talking = false, mood = 'neutral', shades = false, cue = null }) {
  const mountRef = useRef(null);
  // Live prop mirrors so the animation loop sees fresh values without re-init.
  const exprRef = useRef(expression);
  const dragRef = useRef(dragging);
  const talkRef = useRef(talking);
  const moodRef = useRef(mood);
  const shadesRef = useRef(shades);
  const cueRef = useRef(cue);
  const sceneApi = useRef(null);

  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { exprRef.current = expression; }, [expression]);
  useEffect(() => { dragRef.current = dragging; }, [dragging]);
  useEffect(() => { talkRef.current = talking; }, [talking]);
  useEffect(() => { shadesRef.current = shades; }, [shades]);
  useEffect(() => { cueRef.current = cue; }, [cue]);

  // Boot the scene once on mount.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    // updateStyle defaults to true: the canvas CSS size is pinned to `size`px while the
    // drawing buffer stays at size × pixelRatio for crispness. Passing `false` here let
    // the buffer-sized canvas overflow the container on HiDPI screens.
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0); // transparent — Bud floats over the app
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xbff0c4, 0.25);
    rim.position.set(-4, 1, -2);
    scene.add(rim);

    const lush = buildLush();
    scene.add(lush.root);

    // Frame the camera to fit the character automatically, so the whole of Bud is in
    // view regardless of how the procedural model is sized/positioned. Fit to `body`
    // (leaf + limbs + face); the ground shadow is excluded so it doesn't pad the box.
    const fitBox = new THREE.Box3().setFromObject(lush.body);
    const fitCenter = fitBox.getCenter(new THREE.Vector3());
    const fitSize = fitBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(fitSize.x, fitSize.y);
    const vFov = (camera.fov * Math.PI) / 180;
    const fitDist = (maxDim * 0.5 * 1.18) / Math.tan(vFov / 2); // 1.18 = a little margin
    camera.position.set(fitCenter.x, fitCenter.y, fitDist + fitSize.z * 0.5);
    camera.lookAt(fitCenter.x, fitCenter.y, 0);
    camera.updateProjectionMatrix();

    sceneApi.current = { lush };

    // Activate the next free smoke puff at a point, with some sideways spread.
    const emitPuff = (px, py, pz, spread = 0.28) => {
      const p = lush.smoke.puffs.find((q) => !q.userData.active);
      if (!p) return;
      p.userData.active = true;
      p.userData.age = 0;
      p.userData.life = 1.6 + Math.random() * 0.7;
      p.userData.vx = (Math.random() - 0.5) * spread;
      p.position.set(px + (Math.random() - 0.5) * 0.1, py, pz);
      p.scale.setScalar(0.42);
      p.visible = true;
    };

    // ---- input + timing state ----
    const cursor = { x: 0, y: 0 };
    const cursorPx = { x: 0, y: 0 }; // raw pixels, for drag-velocity physics
    const doze = { idle: 0, sleeping: false }; // idle seconds; flips to sleeping past SLEEP_AFTER
    const onPointerMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      cursor.x = (e.clientX / w) * 2 - 1;
      cursor.y = (e.clientY / h) * 2 - 1;
      cursorPx.x = e.clientX;
      cursorPx.y = e.clientY;
      doze.idle = 0;          // any cursor movement wakes him / resets the idle clock
      doze.sleeping = false;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const clock = new THREE.Clock();
    let elapsed = 0;
    let nextBlink = 2 + Math.random() * 3;
    let blink = 0;        // 0 open .. 1 shut
    const blinkState = { active: false, t: 0 };
    let squash = 0;       // eased drag reaction 0..1
    let raf = 0;
    let breathePhase = 0;
    let armBlendR = 0;    // right arm: 0 = rest, 1 = joint at the lips
    let armBlendL = 0;    // left arm: 0 = rest, 1 = lighter up at the joint
    let puffTimer = 0;
    let redness = 0;      // 0 = clear-eyed, 1 = fully bloodshot (ramps while smoking)
    let mouthOpen = 0;    // eased jaw drop 0..~1.3
    let mouthWide = 0.6;  // eased smile width
    let talkClock = 0;    // counts down a "speaking" flap when a tip appears
    let prevTalking = false;
    let prevExpr = exprRef.current;
    let sleepLid = 0;     // eased eyes-shut amount while dozing (0..1)
    // emote.kind: 'smoke' (raise→spark→puff→lower) or a single-phase bit
    // ('wave' | 'stretch' | 'groove' | 'munch' | 'lookAround' | 'scratch' | 'hum' | 'watch').
    const emote = { phase: 'wait', kind: null, t: 0, next: 5 + Math.random() * 6 };
    // Start an idle emote by kind: sets phase (smoke gets its own raise→spark→puff
    // chain, everything else is single-phase and phase === kind), resets its clock,
    // and plays the bit's start-of-cue sound (if it has one) exactly once.
    const startEmote = (kind) => {
      emote.kind = kind;
      emote.phase = kind === 'smoke' ? 'raise' : kind;
      emote.t = 0;
      const soundCue = EMOTE_SOUND_CUE[kind];
      if (soundCue) {
        const rec = cueFor(soundCue);
        if (rec && rec.sound) playCue(rec.sound);
      }
    };
    const cough = { active: false, t: 0, dur: 0.85 };
    // ---- physics-y dragging: pointer velocity drives a limb pendulum + body tilt,
    // and letting go leaves a decaying wobble.
    const vel = { x: 0, y: 0 };                  // smoothed px/s
    const prevPx = { x: 0, y: 0, primed: false };
    const swing = { a: 0, v: 0 };                // arm pendulum (radians)
    const wobble = { t: 99, amp: 0 };            // drop reaction; t counts up
    let prevDragging = false;
    // ---- accessories + time-of-day + sound edge-detectors
    let shadesBlend = 0;
    const lean = { x: 0, y: 0, z: 0 }; // smoothed body lean (see the rotation block)
    let hatBlend = 0;
    // Decimal hour (e.g. 11.5 = 11:30) so pickEmote's noon/late-night windows can
    // see the minute, not just the hour.
    let hour = new Date().getHours() + new Date().getMinutes() / 60;
    let hourCheck = 0;
    let prevFlameOn = false;
    let prevBreathUp = false;
    // ---- one-shot reaction cues (MR-64): the brain hands over { name, at,
    // payload } via a prop; cueRef mirrors it so the loop can edge-detect a
    // new `at` without a re-render. `cue` is the currently-playing cue's own
    // clock; `queuedCue` holds one that must wait for an idle emote to free up.
    let cuesDisabled = false; // dev-only override for the red-proof capture
    let lastCueAt = 0;
    let queuedCue = null;
    const cue = { name: null, payload: null, t: 0, dur: 0, active: false };
    const startCue = (req) => {
      cue.name = req.name; cue.payload = req.payload; cue.dur = req.dur; cue.t = 0; cue.active = true;
      if (req.name === 'land') { wobble.t = 0; wobble.amp = 0.3; } // piggyback the drop-squash wobble
      if (req.name === 'welcomeBack') playCue('pop'); // perk-up-and-wave plays its 'pop' the moment it starts
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return; // pause work while tab is backgrounded

      const dt = Math.min(clock.getDelta(), 0.05);
      elapsed += dt;
      const pose = POSES[exprRef.current] || POSES.idle;
      const { body, eyes, shadow, limbs, joint, lighter, smoke, mouth } = lush;

      // --- blink: a quick triangle (shut then open) over ~0.16s, on a random timer ---
      if (!blinkState.active && elapsed >= nextBlink) { blinkState.active = true; blinkState.t = 0; }
      if (blinkState.active) {
        blinkState.t += dt / 0.16;
        blink = blinkState.t < 0.5 ? blinkState.t * 2 : (1 - blinkState.t) * 2;
        if (blinkState.t >= 1) {
          blinkState.active = false;
          blink = 0;
          nextBlink = elapsed + 2.5 + Math.random() * 3.5;
        }
      }

      // --- time of day: refresh the hour once a minute ---
      hourCheck += dt;
      if (hourCheck >= 60) { hourCheck = 0; const now = new Date(); hour = now.getHours() + now.getMinutes() / 60; }
      const tod = dayMood(hour);
      const excited = moodRef.current === 'excited' && !doze.sleeping;

      // --- drag squash easing ---
      squash = lerp(squash, dragRef.current ? 1 : 0, 1 - Math.pow(0.001, dt));

      // --- drag physics: smoothed pointer velocity feeds an arm pendulum + a body
      // tilt; releasing him leaves a decaying wobble sized by how fast he was moving.
      if (prevPx.primed && dt > 0) {
        const ivx = (cursorPx.x - prevPx.x) / dt;
        const ivy = (cursorPx.y - prevPx.y) / dt;
        vel.x = lerp(vel.x, dragRef.current ? ivx : 0, 0.3);
        vel.y = lerp(vel.y, dragRef.current ? ivy : 0, 0.3);
      }
      prevPx.x = cursorPx.x; prevPx.y = cursorPx.y; prevPx.primed = true;
      const drive = dragRef.current ? THREE.MathUtils.clamp(vel.x * 0.0035, -2.5, 2.5) : 0;
      swing.v += (-32 * swing.a - 6.5 * swing.v + drive * 18) * dt;
      swing.a = THREE.MathUtils.clamp(swing.a + swing.v * dt, -0.9, 0.9);
      if (prevDragging && !dragRef.current) {
        wobble.t = 0;
        wobble.amp = THREE.MathUtils.clamp(Math.hypot(vel.x, vel.y) * 0.0006, 0.08, 0.4);
        swing.v += THREE.MathUtils.clamp(vel.x * 0.008, -4, 4); // arms keep going a beat
      }
      prevDragging = dragRef.current;
      wobble.t += dt;
      const WOBBLE_DUR = 1.1;
      const wobbling = wobble.t < WOBBLE_DUR;
      const wob = wobbling
        ? Math.sin(wobble.t * 14) * wobble.amp * (1 - wobble.t / WOBBLE_DUR)
        : 0;

      // --- breathe (slow + deep while dozing; perkier in the morning) ---
      breathePhase += dt * (doze.sleeping ? 0.45 : pose.breathe * tod.breathe);
      const breath = Math.sin(breathePhase);
      const bounce = (pose.bounce ? Math.abs(Math.sin(elapsed * 6)) * 0.18 : 0)
        + (excited ? Math.abs(Math.sin(elapsed * 3.2)) * 0.07 : 0);
      const sx = 1 + breath * 0.02 + squash * 0.14;
      const sy = (1 + breath * 0.025 - squash * 0.12) * (1 + wob * 0.25);
      body.scale.set(sx, sy, 1 + breath * 0.02);
      body.position.y = breath * 0.05 + bounce - squash * 0.1;

      // --- cursor lean (whole body), plus the drag tilt + drop wobble ---
      const dragTilt = THREE.MathUtils.clamp(vel.x * 0.0009, -0.35, 0.35) * squash;
      const leanY = cursor.x * 0.4;
      const leanX = -cursor.y * 0.22 + breath * 0.03;
      // The smoothed lean lives in its own state and is ASSIGNED to the body
      // each frame. Everything below that nudges body.rotation with `+=` (idle
      // emotes, the cough, the reaction cues) is then a true one-frame offset.
      // Lerping body.rotation from itself and adding on top compounded a
      // constant offset ~10x (sulk's 0.35 rad droop tipped Bud onto his back
      // in the MR-64 capture); the same class as the position.z drift.
      lean.y = lerp(lean.y, leanY + squash * 0.12, 1 - Math.pow(0.0005, dt));
      lean.x = lerp(lean.x, leanX, 1 - Math.pow(0.002, dt));
      lean.z = lerp(lean.z, dragTilt + wob + squash * 0.04 * Math.sin(elapsed * 9), 0.25);
      body.rotation.set(lean.x, lean.y, lean.z);

      // --- cue machine: edge-detect a new one-shot cue request, decide whether
      // it may interrupt an idle emote (per its `interrupts`), and step the
      // currently active one. `walk` has dur 0 (MR-65's) — skip it here, don't crash.
      if (!cuesDisabled && cueRef.current && cueRef.current.at !== lastCueAt) {
        lastCueAt = cueRef.current.at;
        const rec = cueFor(cueRef.current.name);
        if (rec && rec.dur > 0) {
          const req = { name: cueRef.current.name, payload: cueRef.current.payload, dur: rec.dur };
          const emoteBusy = emote.phase !== 'wait' && emote.phase !== 'cooldown';
          if (rec.interrupts || !emoteBusy) {
            if (emoteBusy) { emote.phase = 'cooldown'; emote.t = 0; } // cut the idle emote short
            startCue(req);
          } else {
            queuedCue = req; // wait for the idle emote to reach wait/cooldown
          }
        }
      }
      if (queuedCue && !cue.active && (emote.phase === 'wait' || emote.phase === 'cooldown')) {
        startCue(queuedCue);
        queuedCue = null;
      }
      if (cue.active) {
        cue.t += dt;
        if (cue.t >= cue.dur) { cue.active = false; cue.name = null; cue.payload = null; cue.t = 0; }
      }
      const cueK = cue.active ? cueEnvelope(cue.t / cue.dur) : 0;
      const cueName = cue.active ? cue.name : null;

      // --- cue body language: additive offsets atop the lean/breath pose above,
      // eased in/out by cueK so the cue always returns the body to rest ---
      if (cueName) {
        const cueU = cue.dur > 0 ? cue.t / cue.dur : 1;
        switch (cueName) {
          case 'peek': {
            const side = cursor.x >= 0 ? 1 : -1;
            body.rotation.y += side * 0.22 * cueK; // lean toward the cursor
            body.rotation.x -= 0.08 * cueK;        // small forward tilt
            break;
          }
          case 'nod':
            body.rotation.x += Math.sin(cueU * Math.PI * 2 * 2) * 0.18 * cueK; // two dips
            break;
          case 'wince':
            // Absolute, not "-=": nothing else ever sets body.position.z, so an
            // accumulating subtract here would drift the body away from the
            // camera a little further on every single wince, forever.
            body.position.z = -0.35 * cueK; // recoil back
            break;
          case 'cheer':
            body.position.y += Math.abs(Math.sin(elapsed * 6)) * 0.18 * cueK; // bounce
            break;
          case 'sulk':
            body.rotation.x += 0.35 * cueK; // droop
            break;
          case 'shrug':
            body.rotation.z += 0.15 * cueK; // small head/body tilt
            break;
          case 'facepalm':
            body.position.y -= 0.15 * cueK; // dip
            break;
          case 'welcomeBack':
            body.position.y += Math.abs(Math.sin(elapsed * 7)) * 0.15 * cueK; // perks up
            break;
          default: break; // land: handled by the wobble mechanism triggered in startCue
        }
      }

      // --- idle emote machine: wave, spark up, stretch, groove, or snack ---
      const idleOk = exprRef.current === 'idle' && !dragRef.current;
      emote.t += dt;
      switch (emote.phase) {
        case 'wait':
          if (!idleOk || doze.sleeping || cue.active) emote.t = 0; // also hold off while a reaction cue plays
          else if (emote.t >= emote.next) {
            startEmote(pickEmote(hour, Math.random()));
          }
          break;
        case 'wave':
        case 'stretch':
        case 'groove':
        case 'munch':
        case 'lookAround':
        case 'scratch':
        case 'hum':
        case 'watch':
          if (emote.t >= EMOTE[emote.phase]) { emote.phase = 'cooldown'; emote.t = 0; }
          break;
        case 'raise':
          if (emote.t >= EMOTE.raise) { emote.phase = 'spark'; emote.t = 0; }
          break;
        case 'spark':
          if (emote.t >= EMOTE.spark) { emote.phase = 'puff'; emote.t = 0; }
          break;
        case 'puff':
          if (emote.t >= EMOTE.puff) {
            emote.phase = 'lower'; emote.t = 0;
            // Sometimes the hit catches up with him — a little cough fit.
            if (!cough.active && Math.random() < 0.5) {
              cough.active = true; cough.t = 0;
              emitPuff(COUGH_EMIT.x, COUGH_EMIT.y, COUGH_EMIT.z, 0.6);
              emitPuff(COUGH_EMIT.x, COUGH_EMIT.y, COUGH_EMIT.z, 0.6);
            }
          }
          break;
        case 'lower':
          if (armBlendR < 0.03 && armBlendL < 0.03) { emote.phase = 'cooldown'; emote.t = 0; }
          break;
        case 'cooldown':
          if (emote.t >= EMOTE.cooldown) { emote.phase = 'wait'; emote.kind = null; emote.t = 0; emote.next = 6 + Math.random() * 8; }
          break;
        default: break;
      }
      // If Bud gets busy (a tip pops, or he's grabbed) mid-emote, bail out gracefully.
      if (!idleOk && (emote.phase === 'raise' || emote.phase === 'spark' || emote.phase === 'puff')) {
        emote.phase = 'lower'; emote.t = 0;
      }
      if (!idleOk && (emote.phase === 'wave' || emote.phase === 'stretch' || emote.phase === 'groove' || emote.phase === 'munch'
        || emote.phase === 'lookAround' || emote.phase === 'scratch' || emote.phase === 'hum' || emote.phase === 'watch')) {
        emote.phase = 'cooldown'; emote.t = 0;
      }

      // Arm targets are picked by the emote KIND (which outlives the active phase into
      // the cooldown) so the ease-back-to-rest never jumps between poses. Right arm
      // holds the joint / waves / stretches; left arm lights, stretches, or snacks.
      const holding = emote.kind === 'smoke' && (emote.phase === 'raise' || emote.phase === 'spark' || emote.phase === 'puff');
      const waving = emote.phase === 'wave';
      const sparking = emote.phase === 'spark';
      const stretching = emote.phase === 'stretch';
      const grooving = emote.phase === 'groove';
      const munching = emote.phase === 'munch';
      const lookingAround = emote.phase === 'lookAround';
      const scratching = emote.phase === 'scratch';
      const humming = emote.phase === 'hum';
      const watching = emote.phase === 'watch';
      const rightTarget = emote.kind === 'wave' ? ARM_WAVE.R
        : emote.kind === 'stretch' ? ARM_STRETCH.R
        : emote.kind === 'scratch' ? ARM_SCRATCH.R : ARM_SMOKE.R;
      const leftTarget = emote.kind === 'stretch' ? ARM_STRETCH.L
        : emote.kind === 'watch' ? ARM_WATCH.L : ARM_SMOKE.L;
      armBlendR = lerp(armBlendR, (holding || waving || stretching || scratching) ? 1 : 0, 1 - Math.pow(0.004, dt));
      armBlendL = lerp(armBlendL, (sparking || stretching || munching || watching) ? 1 : 0, 1 - Math.pow(0.002, dt));
      applyArmPose(limbs.armR, ARM_REST.R, rightTarget, armBlendR);
      applyArmPose(limbs.armL, ARM_REST.L, leftTarget, armBlendL);
      // Cue arms take priority over the idle emote's arms: blend from wherever
      // the pose above just landed, toward the cue's target, by cueK.
      if (cueName === 'cheer') {
        applyArmPose(limbs.armL, limbs.armL.rotation, ARM_CHEER.L, cueK);
        applyArmPose(limbs.armR, limbs.armR.rotation, ARM_CHEER.R, cueK);
      } else if (cueName === 'shrug') {
        applyArmPose(limbs.armL, limbs.armL.rotation, ARM_SHRUG.L, cueK);
        applyArmPose(limbs.armR, limbs.armR.rotation, ARM_SHRUG.R, cueK);
      } else if (cueName === 'facepalm') {
        applyArmPose(limbs.armR, limbs.armR.rotation, ARM_FACEPALM.R, cueK);
      } else if (cueName === 'point') {
        const dir = cue.payload && cue.payload.dir === -1 ? -1 : 1;
        const target = dir === -1 ? mirrorArmX(ARM_POINT.R) : ARM_POINT.R;
        applyArmPose(limbs.armR, limbs.armR.rotation, target, cueK);
      } else if (cueName === 'welcomeBack') {
        applyArmPose(limbs.armR, limbs.armR.rotation, ARM_WAVE.R, cueK); // the wave arm pose
      }
      let browBoost = 0;
      if (waving) {
        // Theatrical hello: a big side-to-side arc, a lean into it, little hops, and
        // raised brows — not just a stiff hand wobble.
        limbs.armR.rotation.z += Math.sin(elapsed * 13) * 0.5 * armBlendR;
        limbs.armR.rotation.x += Math.sin(elapsed * 13) * 0.1 * armBlendR;
        body.rotation.z += 0.09 * armBlendR;
        body.position.y += Math.abs(Math.sin(elapsed * 7)) * 0.12 * armBlendR;
        browBoost = 0.25 * armBlendR;
      }
      // Big stretch: arms up, body pulls tall, eyes scrunch into a yawn near the peak.
      const stretchEnv = stretching ? Math.sin(Math.PI * Math.min(1, emote.t / EMOTE.stretch)) : 0;
      if (stretching) {
        body.scale.y *= 1 + stretchEnv * 0.07;
        body.position.y += stretchEnv * 0.08;
        body.rotation.x -= stretchEnv * 0.08; // leans back into it
      }
      if (grooving) {
        // A little shoulder-swaying groove: sway, bob, arms pumping in alternation.
        const beat = elapsed * 5.2;
        body.rotation.z += Math.sin(beat) * 0.12;
        body.position.y += Math.abs(Math.sin(beat)) * 0.1;
        limbs.armL.rotation.z += Math.sin(beat) * 0.4;
        limbs.armR.rotation.z += Math.sin(beat + Math.PI) * 0.4;
        limbs.armL.rotation.x += Math.cos(beat) * 0.15;
        limbs.armR.rotation.x += Math.cos(beat + Math.PI) * 0.15;
      }
      // Scratch: a small side-to-side wiggle of the hand against the head.
      if (scratching) {
        limbs.armR.rotation.z += Math.sin(elapsed * 10) * 0.12 * armBlendR;
      }
      // Hum: closed-mouth sway, gentle side-to-side.
      if (humming) {
        body.rotation.z += Math.sin(elapsed * 2.2) * 0.06;
      }
      // Look around: sweeps gaze left, right, then up over the bit's duration, with
      // a small head turn riding along (a one-frame += per the rotation-block note).
      let lookGaze = null;
      if (lookingAround) {
        const u = Math.min(1, emote.t / EMOTE.lookAround);
        if (u < 0.3) lookGaze = { x: -smoothstep(u / 0.3), y: 0 };
        else if (u < 0.35) lookGaze = { x: -1, y: 0 };
        else if (u < 0.65) lookGaze = { x: -1 + 2 * smoothstep((u - 0.35) / 0.3), y: 0 };
        else if (u < 0.7) lookGaze = { x: 1, y: 0 };
        else if (u < 0.9) {
          const k = smoothstep((u - 0.7) / 0.2);
          lookGaze = { x: 1 - k, y: k };
        } else lookGaze = { x: 0, y: 1 - smoothstep((u - 0.9) / 0.1) };
        body.rotation.y += lookGaze.x * 0.12;
      }
      // Watch: the little wrist-watch disc shows only while the left arm is up
      // checking it; gaze drops to the wrist (down-and-left, cursor-independent).
      const showingWatch = watching && armBlendL > 0.04;
      lush.watch.group.visible = showingWatch;
      // Munchies: the cookie swaps in for the lighter while the left hand is up, and
      // shrinks bite by bite with a chewing arm-bob.
      const snacking = emote.kind === 'munch' && armBlendL > 0.04;
      lush.snack.group.visible = snacking;
      lush.lighter.group.visible = !snacking && !showingWatch;
      if (munching) {
        limbs.armL.rotation.x += Math.sin(elapsed * 9) * 0.07 * armBlendL;
        lush.snack.cookie.scale.setScalar(Math.max(0.25, 1 - (emote.t / EMOTE.munch) * 0.65));
      } else if (emote.kind !== 'munch') {
        lush.snack.cookie.scale.setScalar(1); // fresh cookie next time
      }
      // Drag physics: the pendulum swing rides on top of whatever pose the arms hold.
      limbs.armL.rotation.z += swing.a;
      limbs.armR.rotation.z += swing.a;

      // lighter flame: lit once the lighter has actually reached the joint
      const flameOn = sparking && armBlendL > 0.6;
      if (flameOn && !prevFlameOn) flick(); // the spark-wheel scratch
      prevFlameOn = flameOn;
      lighter.flame.visible = flameOn;
      if (flameOn) {
        lighter.flame.scale.set(0.9 + Math.sin(elapsed * 50) * 0.1, 0.7 + Math.abs(Math.sin(elapsed * 34)) * 0.5, 0.9);
        lighter.flameMaterial.opacity = 0.7 + Math.random() * 0.3;
      }
      // ember: catches once the flame is on it, pulses while puffing, fades after
      const lit = emote.phase === 'puff' || flameOn;
      const emberTarget = lit ? 1.2 + Math.sin(elapsed * 7) * 0.3 : 0;
      joint.tipMaterial.emissiveIntensity = lerp(joint.tipMaterial.emissiveIntensity, emberTarget, 0.12);

      // --- bloodshot eyes: redden while smoking, then fade out slowly ---
      const reddening = emote.phase === 'spark' || emote.phase === 'puff';
      redness = reddening ? Math.min(1, redness + dt * 0.7) : Math.max(0, redness - dt * 0.045);

      // --- cough fit: a few decaying forward lurches + an eye scrunch ---
      let coughPitch = 0;
      let coughSquint = 0;
      if (cough.active) {
        cough.t += dt;
        if (cough.t >= cough.dur) {
          cough.active = false;
        } else {
          const env = 1 - cough.t / cough.dur;
          const osc = Math.sin(cough.t * 22);
          coughPitch = osc * 0.3 * env;                 // lurch forward/back
          coughSquint = Math.max(0, osc) * 0.55 * env;  // scrunch on each heave
        }
      }
      body.rotation.x += coughPitch;
      body.position.y -= Math.abs(coughPitch) * 0.15;

      // --- doze off after a stretch of stillness (suppressed when concerned) ---
      // Doze once he's not actively speaking (talkClock), even if a bubble lingers.
      const canDoze = idleOk && (emote.phase === 'wait' || emote.phase === 'cooldown')
        && talkClock <= 0 && moodRef.current !== 'concerned';
      if (canDoze) doze.idle += dt; else { doze.idle = 0; doze.sleeping = false; }
      if (doze.idle >= SLEEP_AFTER * tod.sleepAfter) doze.sleeping = true; // nods off faster at night
      sleepLid = lerp(sleepLid, doze.sleeping ? 1 : 0, 1 - Math.pow(0.02, dt));
      // One soft snore per breath cycle while he's fully under.
      const breathUp = breath > 0;
      if (doze.sleeping && sleepLid > 0.8 && breathUp && !prevBreathUp) snore();
      prevBreathUp = breathUp;
      // Concerned: a worried resting look when his plant is unhealthy and nothing else is going on.
      const concerned = exprRef.current === 'idle' && moodRef.current === 'concerned'
        && !doze.sleeping && emote.phase === 'wait';

      // --- mouth: talk flap + smoke/cough shapes layered over the expression base ---
      const talkingNow = talkRef.current;
      if (talkingNow && (!prevTalking || exprRef.current !== prevExpr)) talkClock = 1.8;
      // Greeting wave: when he starts talking while idle, give a little hello wave.
      if (talkingNow && !prevTalking && exprRef.current === 'idle' && emote.phase === 'wait') {
        emote.kind = 'wave'; emote.phase = 'wave'; emote.t = 0;
      }
      prevTalking = talkingNow;
      prevExpr = exprRef.current;
      if (talkClock > 0) talkClock = Math.max(0, talkClock - dt);

      const mb = MOUTH_BASE[exprRef.current] || MOUTH_BASE.idle;
      let mOpen = mb.open;
      let mWide = mb.wide;
      if (excited) { mOpen = Math.max(mOpen, 0.12); mWide = Math.max(mWide, 0.9); } // can't hide it
      if (holding) { mOpen = 0.1; mWide = 0.32; }                  // pursed around the joint
      if (emote.phase === 'puff') {                                // exhaling — a few O pulses
        mOpen = 0.2 + Math.max(0, Math.sin(emote.t * 5)) * 0.5;
        mWide = 0.42;
      }
      if (waving || grooving) { mOpen = 0.2; mWide = 0.95; }       // grinning through it
      if (stretching) { mOpen = stretchEnv * 1.1; mWide = 0.5; }   // biiig yawn at the peak
      if (munching) {                                              // chomp chomp
        mOpen = 0.12 + Math.max(0, Math.sin(elapsed * 9)) * 0.35 * armBlendL;
        mWide = 0.55;
      }
      if (humming) { mOpen = 0.02; mWide = 0.7; }                   // closed-mouth hum
      if (talkClock > 0) {                                         // chatting away
        mOpen = 0.12 + (0.5 + 0.5 * Math.sin(elapsed * 19)) * 0.6;
        mWide = 0.85;
      }
      if (cough.active) {                                          // hacking wide
        mOpen = Math.max(mOpen, Math.max(0, Math.sin(cough.t * 22)) * 1.2);
        mWide = 0.5;
      }
      if (concerned) { mOpen = 0.03; mWide = 0.5; }                // small worried mouth
      if (doze.sleeping) { mOpen = 0.06; mWide = 0.45; }           // soft, slack
      // Cue mouths get the last word (highest priority): a reaction cue should
      // read on the face even mid-emote-cooldown or mid-tip.
      const sulking = cueName === 'sulk';
      if (cueName === 'nod') { mOpen = lerp(mOpen, 0.08, cueK); mWide = lerp(mWide, 0.8, cueK); }       // small approving smile
      if (cueName === 'wince') { mOpen = lerp(mOpen, 0.03, cueK); mWide = lerp(mWide, 0.32, cueK); }    // small flinch mouth
      if (cueName === 'cheer') { mOpen = lerp(mOpen, 0.5, cueK); mWide = lerp(mWide, 1.0, cueK); }      // big grin
      if (sulking) { mOpen = lerp(mOpen, 0.02, cueK); mWide = lerp(mWide, 0.45, cueK); }                // frowny (flip below)
      if (cueName === 'shrug') { mOpen = lerp(mOpen, 0.02, cueK); mWide = lerp(mWide, 0.5, cueK); }     // flat "beats me"
      if (cueName === 'welcomeBack') { mOpen = lerp(mOpen, 0.5, cueK); mWide = lerp(mWide, 1.0, cueK); } // big smile
      mouthOpen = lerp(mouthOpen, mOpen, 0.4);
      mouthWide = lerp(mouthWide, mWide, 0.3);
      const mw = 0.55 + mouthWide * 0.7;
      // Flip the smile into a frown when worried, or sulking (eased by cueK).
      mouth.lips.scale.set(mw, 1 - (concerned ? 1.85 : 0) - (sulking ? 1.85 * cueK : 0), 1);
      // Cavity: cap the height and anchor its top at the lip line so it opens DOWN
      // (not a big ball hanging off his chin).
      const openH = Math.min(0.42, mouthOpen * 0.4); // half-height of the opening
      mouth.open.scale.set(mw * 0.85, Math.max(0.001, openH / 0.5), 1);
      mouth.open.position.y = 0.02 - openH;
      const tongueShow = Math.max(0.001, openH - 0.16);
      mouth.tongue.scale.setScalar(tongueShow * 1.6);
      mouth.tongue.position.y = 0.04 - openH * 1.4;

      // smoke puffs: emit on a cadence during the puff phase, then rise + grow + fade
      puffTimer += dt;
      if (emote.phase === 'puff' && puffTimer >= 0.32) {
        puffTimer = 0;
        emitPuff(SMOKE_EMIT.x, SMOKE_EMIT.y, SMOKE_EMIT.z);
      }
      smoke.puffs.forEach((p) => {
        const u = p.userData;
        if (!u.active) return;
        u.age += dt;
        const k = u.age / u.life;
        if (k >= 1) { u.active = false; p.visible = false; p.material.opacity = 0; return; }
        p.position.y += dt * 0.8;
        p.position.x += u.vx * dt;
        p.scale.setScalar(0.42 + k * 1.35);
        // fade in quickly, then out — a softer plume than a hard pop
        p.material.opacity = Math.min(1, k * 5) * (1 - k) * 0.7;
      });

      // --- per-eye: gaze, lids, brows, bloodshot ---
      const smokeDroop = emote.phase === 'puff' ? 0.22 : 0; // chilled-out half-lids
      const concernDroop = concerned ? 0.3 : 0;
      // Cue lids/brows: narrowed for peek/wince, half for sulk, shut for facepalm;
      // brows knit for wince, lift for shrug. All eased by cueK.
      let cueLidDroop = 0;
      let cueBrowYDelta = 0;
      let cueBrowKnit = 0;
      switch (cueName) {
        case 'peek': cueLidDroop = 0.22 * cueK; cueBrowYDelta = -0.3 * cueK; break;
        case 'wince': cueLidDroop = 0.35 * cueK; cueBrowKnit = 0.16 * cueK; break;
        case 'sulk': cueLidDroop = 0.5 * cueK; break;
        case 'facepalm': cueLidDroop = 0.95 * cueK; break;
        case 'shrug': cueBrowYDelta = 0.3 * cueK; break;
        case 'welcomeBack': cueBrowYDelta = 0.3 * cueK; break; // brows up
        default: break;
      }
      // Lids scale with the time of day (heavy at night) and pop a little when excited.
      const wide = dragRef.current ? 1
        : Math.min(1, pose.lidOpen * tod.lid + (excited ? 0.15 : 0));
      // sleepLid forces the eyes shut while dozing; a big stretch scrunches them too.
      const effLidOpen = Math.max(0, wide - smokeDroop - coughSquint - concernDroop - stretchEnv * 0.6 - cueLidDroop)
        * (1 - blink) * (1 - sleepLid);
      eyes.forEach((eye, i) => {
        const { pupil, lid, brow, R } = eye;
        // redness: brighten the capillaries and tint the sclera toward pink
        if (eye.veinMats) for (const m of eye.veinMats) m.opacity = lerp(VEIN_REST, VEIN_MAX, redness);
        if (eye.scleraMat) {
          eye.scleraMat.color.setRGB(
            lerp(SCLERA_CLEAR.r, SCLERA_RED.r, redness),
            lerp(SCLERA_CLEAR.g, SCLERA_RED.g, redness),
            lerp(SCLERA_CLEAR.b, SCLERA_RED.b, redness),
          );
        }
        // gaze toward the cursor (clamped to the sclera), plus the pose's vertical bias
        let gx = THREE.MathUtils.clamp(cursor.x * 0.6 + (i === 0 ? 0.02 : -0.02), -1, 1) * R * 0.42;
        let gy = THREE.MathUtils.clamp(-cursor.y * 0.5 + pose.gazeY, -1, 1) * R * 0.4;
        if (cueName === 'point') {
          const dir = cue.payload && cue.payload.dir === -1 ? -1 : 1;
          gx = lerp(gx, dir * R * 0.4, cueK);
          gy = lerp(gy, 0, cueK);
        }
        // Look around: a cursor-independent gaze override sweeping left/right/up.
        if (lookGaze) { gx = lookGaze.x * R * 0.42; gy = lookGaze.y * R * 0.4; }
        // Watch: gaze drops down-and-left to the wrist, cursor-independent.
        if (showingWatch) { gx = -R * 0.3; gy = -R * 0.35; }
        pupil.position.x = lerp(pupil.position.x, gx, 0.18);
        pupil.position.y = lerp(pupil.position.y, gy, 0.18);
        // lid: y from -0.1R (shut) to 1.2R (wide open)
        const lidY = lerp(-0.1 * R, 1.2 * R, effLidOpen);
        lid.position.y = lerp(lid.position.y, lidY, 0.4);
        // brow lifts with the pose / surprise, and lowers + knits inward when worried
        const browBaseY = 1.05 * R;
        const targetBrowY = browBaseY
          + (pose.browLift + squash * 0.25 + browBoost + (excited ? 0.18 : 0) - (concerned ? 0.4 : 0) + cueBrowYDelta) * R;
        brow.position.y = lerp(brow.position.y, targetBrowY, 0.25);
        const targetBrowX = (concerned ? (i === 0 ? 0.12 : -0.12) * R : 0)
          + (cueBrowKnit ? (i === 0 ? cueBrowKnit : -cueBrowKnit) * R : 0);
        brow.position.x = lerp(brow.position.x, targetBrowX, 0.2);
      });

      // --- dynamic ground shadow: smaller + fainter as Bud rises ---
      const lift = body.position.y;
      const sc = THREE.MathUtils.clamp(1 - lift * 0.5, 0.7, 1.15);
      shadow.scale.set(sc, sc, sc);
      shadow.material.opacity = THREE.MathUtils.clamp(0.5 - lift * 0.3, 0.12, 0.6);

      // --- accessories: shades slide down when the grow's dialed in; a party hat
      // pops on whenever he's celebrating ---
      shadesBlend = lerp(shadesBlend, shadesRef.current ? 1 : 0, 1 - Math.pow(0.01, dt));
      lush.shades.group.visible = shadesBlend > 0.02;
      lush.shades.group.position.y = (1 - shadesBlend) * 1.6; // drop in from above
      const hatOn = exprRef.current === 'celebrating';
      hatBlend = lerp(hatBlend, hatOn ? 1 : 0, 1 - Math.pow(0.005, dt));
      lush.hat.group.visible = hatBlend > 0.02;
      const hatPop = hatBlend * (1 + Math.sin(Math.min(1, hatBlend) * Math.PI) * 0.25);
      lush.hat.group.scale.setScalar(Math.max(0.001, hatPop));

      // --- "Zzz" drifting up while he dozes ---
      lush.zzz.sprites.forEach((z, i) => {
        if (sleepLid < 0.4) { z.visible = false; return; }
        const phase = ((elapsed * 0.45 + i / 3) % 1);
        z.visible = true;
        z.position.set(phase * 0.6, phase * 1.3, 0);
        z.scale.setScalar(0.4 + phase * 0.6);
        z.material.opacity = Math.sin(phase * Math.PI) * 0.85 * sleepLid;
      });

      renderer.render(scene, camera);
    };

    raf = requestAnimationFrame(tick);

    // Dev-only handle for tuning the emote (force the smoke pose, reset). Gated to
    // `import.meta.env.DEV`, so it never reaches the production bundle.
    if (import.meta.env.DEV) {
      window.__bud = {
        smoke: () => startEmote('smoke'),
        wave: () => startEmote('wave'),
        stretch: () => startEmote('stretch'),
        groove: () => startEmote('groove'),
        munch: () => startEmote('munch'),
        // MR-68: generalised idle-emote trigger (covers the four new bits too) and
        // the pure weighted-pick function, exposed so the roulette can be measured
        // (counted) rather than eyeballed.
        emote: (name) => startEmote(name),
        pickEmote: (h, rand) => pickEmote(h, rand),
        shades: (v = true) => { shadesRef.current = Boolean(v); },
        setHour: (h) => { hour = h; hourCheck = -3600; },
        setExpr: (e) => { exprRef.current = e; },
        rest: () => { emote.phase = 'cooldown'; emote.t = 0; doze.idle = 0; doze.sleeping = false; },
        sleep: () => { emote.phase = 'wait'; emote.t = 0; talkClock = 0; doze.idle = SLEEP_AFTER + 1; doze.sleeping = true; },
        setMood: (m) => { moodRef.current = m; },
        cough: () => { cough.active = true; cough.t = 0; },
        talk: (s = 2.5) => { talkClock = s; },
        // MR-64: fire a one-shot reaction cue, same shape the brain hands in via props.
        cue: (name, payload) => { cueRef.current = { name, at: Date.now(), payload }; },
        disableCues: () => { cuesDisabled = true; },  // red-proof: cue() becomes a no-op
        enableCues: () => { cuesDisabled = false; },
        lush, camera, renderer, scene,
      };
    }

    return () => {
      cancelAnimationFrame(raf);
      if (import.meta.env.DEV && window.__bud && window.__bud.lush === lush) delete window.__bud;
      window.removeEventListener('pointermove', onPointerMove);
      lush.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneApi.current = null;
    };
    // size is effectively constant for the mascot; re-init if it ever changes.
  }, [size]);

  return (
    <div
      ref={mountRef}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Bud the 3D leaf, looking ${expression}`}
    />
  );
}
