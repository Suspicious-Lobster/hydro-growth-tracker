import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildLush, ARM_REST, ARM_SMOKE, ARM_WAVE, BLOODSHOT } from './lush/buildLush';

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

// Idle "spark up a smoke" emote: phase durations (seconds) and the body-space point
// the smoke rises from (near Bud's mouth). Only fires while he's idle and undisturbed.
const EMOTE = { raise: 1.0, spark: 1.4, puff: 2.4, wave: 1.5, cooldown: 8 };
const SMOKE_EMIT = { x: 0.26, y: 0.0, z: 0.97 };
const COUGH_EMIT = { x: 0.05, y: -0.05, z: 0.78 }; // from the mouth, when he coughs
const SLEEP_AFTER = 28; // seconds of stillness before Bud dozes off

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

export default function BudThree({ expression = 'idle', size = 108, dragging = false, talking = false, mood = 'neutral' }) {
  const mountRef = useRef(null);
  // Live prop mirrors so the animation loop sees fresh values without re-init.
  const exprRef = useRef(expression);
  const dragRef = useRef(dragging);
  const talkRef = useRef(talking);
  const moodRef = useRef(mood);
  const sceneApi = useRef(null);

  useEffect(() => { moodRef.current = mood; }, [mood]);
  useEffect(() => { exprRef.current = expression; }, [expression]);
  useEffect(() => { dragRef.current = dragging; }, [dragging]);
  useEffect(() => { talkRef.current = talking; }, [talking]);

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
    const doze = { idle: 0, sleeping: false }; // idle seconds; flips to sleeping past SLEEP_AFTER
    const onPointerMove = (e) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      cursor.x = (e.clientX / w) * 2 - 1;
      cursor.y = (e.clientY / h) * 2 - 1;
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
    // emote.kind: 'smoke' (raise→spark→puff→lower) or 'wave' (a quick hello).
    const emote = { phase: 'wait', kind: null, t: 0, next: 5 + Math.random() * 6 };
    const cough = { active: false, t: 0, dur: 0.85 };

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

      // --- drag squash easing ---
      squash = lerp(squash, dragRef.current ? 1 : 0, 1 - Math.pow(0.001, dt));

      // --- breathe (slow + deep while dozing) ---
      breathePhase += dt * (doze.sleeping ? 0.45 : pose.breathe);
      const breath = Math.sin(breathePhase);
      const bounce = pose.bounce ? Math.abs(Math.sin(elapsed * 6)) * 0.18 : 0;
      const sx = 1 + breath * 0.02 + squash * 0.14;
      const sy = 1 + breath * 0.025 - squash * 0.12;
      body.scale.set(sx, sy, 1 + breath * 0.02);
      body.position.y = breath * 0.05 + bounce - squash * 0.1;

      // --- cursor lean (whole body) ---
      const leanY = cursor.x * 0.4;
      const leanX = -cursor.y * 0.22 + breath * 0.03;
      body.rotation.y = lerp(body.rotation.y, leanY + squash * 0.12, 1 - Math.pow(0.0005, dt));
      body.rotation.x = lerp(body.rotation.x, leanX, 1 - Math.pow(0.002, dt));
      body.rotation.z = lerp(body.rotation.z, squash * 0.06 * Math.sin(elapsed * 9), 0.2);

      // --- idle emote machine: occasionally wave hello or spark up a smoke ---
      const idleOk = exprRef.current === 'idle' && !dragRef.current;
      emote.t += dt;
      switch (emote.phase) {
        case 'wait':
          if (!idleOk || doze.sleeping) emote.t = 0; // only count toward it while awake + chilling
          else if (emote.t >= emote.next) {
            emote.kind = Math.random() < 0.45 ? 'wave' : 'smoke';
            emote.phase = emote.kind === 'wave' ? 'wave' : 'raise';
            emote.t = 0;
          }
          break;
        case 'wave':
          if (emote.t >= EMOTE.wave) { emote.phase = 'cooldown'; emote.t = 0; }
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
      if (!idleOk && emote.phase === 'wave') { emote.phase = 'cooldown'; emote.t = 0; }

      // Right arm holds the joint up while smoking AND does the waving; the left arm
      // only comes up during the spark to light the joint, then drops away.
      const holding = emote.kind === 'smoke' && (emote.phase === 'raise' || emote.phase === 'spark' || emote.phase === 'puff');
      const waving = emote.phase === 'wave';
      const sparking = emote.phase === 'spark';
      const rightTarget = waving ? ARM_WAVE.R : ARM_SMOKE.R;
      armBlendR = lerp(armBlendR, (holding || waving) ? 1 : 0, 1 - Math.pow(0.004, dt));
      armBlendL = lerp(armBlendL, sparking ? 1 : 0, 1 - Math.pow(0.002, dt));
      applyArmPose(limbs.armR, ARM_REST.R, rightTarget, armBlendR);
      applyArmPose(limbs.armL, ARM_REST.L, ARM_SMOKE.L, armBlendL);
      if (waving) {
        limbs.armR.rotation.z += Math.sin(elapsed * 16) * 0.28 * armBlendR; // side-to-side wave
        limbs.armR.rotation.x += Math.sin(elapsed * 16) * 0.05 * armBlendR;
      }

      // lighter flame: lit once the lighter has actually reached the joint
      const flameOn = sparking && armBlendL > 0.6;
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
      if (doze.idle >= SLEEP_AFTER) doze.sleeping = true;
      sleepLid = lerp(sleepLid, doze.sleeping ? 1 : 0, 1 - Math.pow(0.02, dt));
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
      if (holding) { mOpen = 0.1; mWide = 0.32; }                  // pursed around the joint
      if (emote.phase === 'puff') {                                // exhaling — a few O pulses
        mOpen = 0.2 + Math.max(0, Math.sin(emote.t * 5)) * 0.5;
        mWide = 0.42;
      }
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
      mouthOpen = lerp(mouthOpen, mOpen, 0.4);
      mouthWide = lerp(mouthWide, mWide, 0.3);
      const mw = 0.55 + mouthWide * 0.7;
      // Flip the smile into a frown when worried.
      mouth.lips.scale.set(mw, concerned ? -0.85 : 1, 1);
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
      const wide = dragRef.current ? 1 : pose.lidOpen; // surprised while grabbed
      // sleepLid forces the eyes shut while dozing.
      const effLidOpen = Math.max(0, wide - smokeDroop - coughSquint - concernDroop) * (1 - blink) * (1 - sleepLid);
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
        const gx = THREE.MathUtils.clamp(cursor.x * 0.6 + (i === 0 ? 0.02 : -0.02), -1, 1) * R * 0.42;
        const gy = THREE.MathUtils.clamp(-cursor.y * 0.5 + pose.gazeY, -1, 1) * R * 0.4;
        pupil.position.x = lerp(pupil.position.x, gx, 0.18);
        pupil.position.y = lerp(pupil.position.y, gy, 0.18);
        // lid: y from -0.1R (shut) to 1.2R (wide open)
        const lidY = lerp(-0.1 * R, 1.2 * R, effLidOpen);
        lid.position.y = lerp(lid.position.y, lidY, 0.4);
        // brow lifts with the pose / surprise, and lowers + knits inward when worried
        const browBaseY = 1.05 * R;
        const targetBrowY = browBaseY + (pose.browLift + squash * 0.25 - (concerned ? 0.4 : 0)) * R;
        brow.position.y = lerp(brow.position.y, targetBrowY, 0.25);
        const targetBrowX = concerned ? (i === 0 ? 0.12 : -0.12) * R : 0;
        brow.position.x = lerp(brow.position.x, targetBrowX, 0.2);
      });

      // --- dynamic ground shadow: smaller + fainter as Bud rises ---
      const lift = body.position.y;
      const sc = THREE.MathUtils.clamp(1 - lift * 0.5, 0.7, 1.15);
      shadow.scale.set(sc, sc, sc);
      shadow.material.opacity = THREE.MathUtils.clamp(0.5 - lift * 0.3, 0.12, 0.6);

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
        smoke: () => { emote.kind = 'smoke'; emote.phase = 'raise'; emote.t = 0; },
        wave: () => { emote.kind = 'wave'; emote.phase = 'wave'; emote.t = 0; },
        rest: () => { emote.phase = 'cooldown'; emote.t = 0; doze.idle = 0; doze.sleeping = false; },
        sleep: () => { emote.phase = 'wait'; emote.t = 0; talkClock = 0; doze.idle = SLEEP_AFTER + 1; doze.sleeping = true; },
        setMood: (m) => { moodRef.current = m; },
        cough: () => { cough.active = true; cough.t = 0; },
        talk: (s = 2.5) => { talkClock = s; },
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
