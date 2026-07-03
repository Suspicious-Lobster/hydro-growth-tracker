import * as THREE from 'three';

// Procedural construction of "Lush" — a Sativa-style 9-finger serrated cannabis-leaf
// buddy. Everything here is built in code (no glTF / external assets). The factory
// returns the root THREE.Group plus named handles that BudThree's animation loop
// nudges each frame (gaze, blink, lean, expression, drag squash). Keep this module
// free of animation/lifecycle logic — it only assembles geometry.

// ---- Tunables -------------------------------------------------------------
export const COLORS = {
  leaf: '#49b85a',      // brighter spring-green per the locked brief
  leafDark: '#2f7d3c',  // limbs / shading accents
  sclera: '#fbfbf4',
  ink: '#141414',       // pupils, mouth, brows
  socket: '#1f5a29',    // recessed eye socket
  vein: '#d6453f',      // bloodshot capillaries
};

// How red the eyes are (0 = clear, 1 = very bloodshot). Exposed per the brief —
// the user wanted Bud's eyes "a bit red. lol". ~0.4 is a subtle, friendly amount.
export const BLOODSHOT = 0.4;

const LEAFLET_ANGLES = [0, 24, 24, 48, 48, 70, 70, 90, 90]; // degrees from vertical
const LEAFLET_SIGNS = [0, 1, -1, 1, -1, 1, -1, 1, -1];
const LEAFLET_LENGTHS = [3.0, 2.7, 2.7, 2.15, 2.15, 1.5, 1.5, 0.95, 0.95];

// ---- Geometry helpers -----------------------------------------------------

// One serrated cannabis leaflet as a flat THREE.Shape pointing up (+Y) from the
// origin (the petiole "wrist"). Width swells in the lower third then tapers to a
// sharp tip; the edge zig-zags into forward-leaning teeth.
function makeLeafletShape(length, width, teeth = 6) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);

  // Smooth half-width envelope: 0 at base, max in lower-middle, 0 at the tip.
  const envelope = (t) => Math.sin(Math.pow(t, 0.62) * Math.PI) * width;

  const right = [];
  for (let i = 1; i <= teeth; i += 1) {
    const t = i / (teeth + 1);
    const y = t * length;
    const w = envelope(t);
    // notch (pulled toward the midrib) then tooth tip (pushed out + up)
    right.push([w * 0.7, y - length * 0.01]);
    right.push([w, y + length * 0.045]);
  }

  right.forEach(([x, y]) => shape.lineTo(x, y));
  shape.lineTo(0, length);                       // sharp tip
  for (let i = right.length - 1; i >= 0; i -= 1) {
    shape.lineTo(-right[i][0], right[i][1]);      // mirror down the left side
  }
  shape.lineTo(0, 0);
  return shape;
}

function makeLeaf(track) {
  const leaf = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.leaf, roughness: 0.62, metalness: 0.02, side: THREE.DoubleSide,
    flatShading: false,
  });
  track.materials.push(mat);

  const extrude = { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 };

  for (let i = 0; i < LEAFLET_ANGLES.length; i += 1) {
    const len = LEAFLET_LENGTHS[i];
    const shape = makeLeafletShape(len, len * 0.26);
    const geo = new THREE.ExtrudeGeometry(shape, extrude);
    track.geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    const angle = THREE.MathUtils.degToRad(LEAFLET_ANGLES[i] * LEAFLET_SIGNS[i]);
    mesh.rotation.z = angle;
    // Fan the fingers slightly in depth so the leaf reads as 3D, not a flat decal.
    mesh.position.z = -Math.abs(LEAFLET_SIGNS[i]) * 0.18 * (i > 0 ? 1 : 0);
    mesh.rotation.y = -angle * 0.25;
    leaf.add(mesh);
  }
  // Lift so the wrist sits low and the fan rises above the face. Scaled up and set
  // back a touch so the big leaf reads as Bud's backdrop while the face stays clear.
  leaf.position.set(0, -0.6, -0.25);
  leaf.scale.setScalar(1.35);
  return leaf;
}

// A short curved capillary laid over the front of the sclera.
function makeVein(track, radius) {
  const a = (Math.PI / 6) + Math.random() * (Math.PI * 1.4);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(Math.cos(a) * radius * 0.15, Math.sin(a) * radius * 0.15, radius * 0.92),
    new THREE.Vector3(Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5, radius * 0.86),
    new THREE.Vector3(Math.cos(a + 0.5) * radius * 0.82, Math.sin(a + 0.5) * radius * 0.82, radius * 0.72),
  ]);
  const geo = new THREE.TubeGeometry(curve, 8, radius * 0.018, 4, false);
  track.geometries.push(geo);
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.vein, transparent: true, opacity: 0.55 * BLOODSHOT });
  track.materials.push(mat);
  return new THREE.Mesh(geo, mat);
}

// One googly eye: recessed socket, white eyeball, pupil, upper lid (covers the eye
// for droop/blink/wide), brow, and a few faint bloodshot veins.
function makeEye(track, side) {
  const group = new THREE.Group();
  const R = 0.5;

  const socketGeo = new THREE.CircleGeometry(R * 1.28, 24);
  const socketMat = new THREE.MeshStandardMaterial({ color: COLORS.socket, roughness: 0.8 });
  track.geometries.push(socketGeo); track.materials.push(socketMat);
  const socket = new THREE.Mesh(socketGeo, socketMat);
  socket.position.z = -0.05;
  group.add(socket);

  const ballGeo = new THREE.SphereGeometry(R, 28, 28);
  const ballMat = new THREE.MeshStandardMaterial({ color: COLORS.sclera, roughness: 0.35, metalness: 0.0 });
  track.geometries.push(ballGeo); track.materials.push(ballMat);
  const eyeball = new THREE.Mesh(ballGeo, ballMat);
  group.add(eyeball);

  // Bloodshot capillaries. We keep references to their materials (and the sclera
  // material) so BudThree can dial the redness up while Bud is smoking.
  const veinMats = [];
  if (BLOODSHOT > 0) {
    const veins = new THREE.Group();
    const count = Math.round(3 + BLOODSHOT * 5);
    for (let i = 0; i < count; i += 1) {
      const v = makeVein(track, R);
      veinMats.push(v.material);
      veins.add(v);
    }
    eyeball.add(veins);
  }

  const pupilGeo = new THREE.SphereGeometry(R * 0.42, 18, 18);
  const pupilMat = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.5 });
  track.geometries.push(pupilGeo); track.materials.push(pupilMat);
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.z = R * 0.78;
  // A tiny catch-light so the eye looks wet/alive.
  const glintGeo = new THREE.SphereGeometry(R * 0.12, 8, 8);
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  track.geometries.push(glintGeo); track.materials.push(glintMat);
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.position.set(R * 0.16, R * 0.16, R * 0.34);
  pupil.add(glint);
  eyeball.add(pupil);

  // Upper lid: a leaf-coloured dome that slides down over the eye. y=0 fully open.
  const lidGeo = new THREE.SphereGeometry(R * 1.08, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const lidMat = new THREE.MeshStandardMaterial({ color: COLORS.leaf, roughness: 0.62, side: THREE.DoubleSide });
  track.geometries.push(lidGeo); track.materials.push(lidMat);
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.y = R * 1.15; // start raised (open)
  group.add(lid);

  // Brow: a short dark arc above the eye.
  const browGeo = new THREE.TorusGeometry(R * 0.78, R * 0.07, 6, 16, Math.PI * 0.7);
  const browMat = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.7 });
  track.geometries.push(browGeo); track.materials.push(browMat);
  const brow = new THREE.Mesh(browGeo, browMat);
  brow.rotation.z = Math.PI - 0.2 * side; // arch outward
  brow.position.set(0, R * 1.05, R * 0.2);
  group.add(brow);

  return { group, eyeball, pupil, lid, brow, R, veinMats, scleraMat: ballMat };
}

// Build a mouth geometry for a given expression. Returned geometry sits in the XY
// plane facing +Z; the caller positions/owns it and disposes the previous one.
export function makeMouthGeometry(expression) {
  if (expression === 'alert') {
    // small surprised "o"
    return new THREE.TorusGeometry(0.16, 0.07, 8, 18);
  }

  const shape = new THREE.Shape();
  if (expression === 'celebrating') {
    // big open grin
    shape.moveTo(-0.6, 0.1);
    shape.quadraticCurveTo(0, -0.7, 0.6, 0.1);
    shape.quadraticCurveTo(0, -0.2, -0.6, 0.1);
  } else if (expression === 'happy') {
    shape.moveTo(-0.55, 0.12);
    shape.quadraticCurveTo(0, -0.5, 0.55, 0.12);
    shape.quadraticCurveTo(0, -0.12, -0.55, 0.12);
  } else {
    // idle: relaxed dopey grin
    shape.moveTo(-0.48, 0.06);
    shape.quadraticCurveTo(0, -0.34, 0.48, 0.06);
    shape.quadraticCurveTo(0, -0.04, -0.48, 0.06);
  }
  return new THREE.ShapeGeometry(shape, 24);
}

// An animatable mouth. Returns the group + the parts BudThree drives every frame:
//  - `lips`: the resting smile (always shown), stretched wider/narrower.
//  - `open`: a dark cavity that scales vertically as the jaw drops (talk/exhale/cough).
//  - `tongue`: a pink tongue that only appears when the mouth is wide open.
function makeMouth(track) {
  const group = new THREE.Group();
  const darkMat = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.6, side: THREE.DoubleSide });
  track.materials.push(darkMat);

  const lipsGeo = makeMouthGeometry('idle');
  track.geometries.push(lipsGeo);
  const lips = new THREE.Mesh(lipsGeo, darkMat);
  group.add(lips);

  // open cavity — a unit ellipse (ry 0.5) centred on its origin. BudThree scales it
  // and shifts it down each frame so its TOP stays at the lip line and it opens down.
  const ovalShape = new THREE.Shape();
  ovalShape.absellipse(0, 0, 0.36, 0.5, 0, Math.PI * 2, false, 0);
  const ovalGeo = new THREE.ShapeGeometry(ovalShape, 28);
  track.geometries.push(ovalGeo);
  const open = new THREE.Mesh(ovalGeo, darkMat);
  open.position.set(0, 0.02, -0.01);
  open.scale.set(1, 0.001, 1);
  group.add(open);

  const tongueMat = new THREE.MeshStandardMaterial({ color: '#d76a72', roughness: 0.55, side: THREE.DoubleSide });
  track.materials.push(tongueMat);
  const tongueShape = new THREE.Shape();
  tongueShape.absellipse(0, 0, 0.24, 0.16, 0, Math.PI * 2, false, 0);
  const tongueGeo = new THREE.ShapeGeometry(tongueShape, 20);
  track.geometries.push(tongueGeo);
  const tongue = new THREE.Mesh(tongueGeo, tongueMat);
  tongue.position.set(0, -0.42, 0.01);
  tongue.scale.setScalar(0.001);
  group.add(tongue);

  return { group, lips, open, tongue };
}

const ARM_LEN = 0.95;

// Arm poses, as shoulder-pivot Euler angles. The arm geometry hangs along -Y from
// the pivot, so rotating the pivot swings the whole arm + hand. REST = hanging
// down-and-out; SMOKE = right hand brings the joint to the mouth while the left
// hand brings the lighter up beneath it. Tuned by eye — easy to nudge here.
export const ARM_REST = {
  L: { x: 0.15, y: 0.0, z: -1.0 }, // hangs down-and-out to the left
  R: { x: 0.15, y: 0.0, z: 1.0 },  // hangs down-and-out to the right
};
export const ARM_SMOKE = {
  L: { x: -1.1, y: -0.05, z: 1.2 }, // lighter hand, comes up under the joint tip
  R: { x: -0.95, y: 0.1, z: -1.25 }, // joint hand, holds it at the lips
};
// Right arm raised up-and-out to the side to wave hello (clear of the leaf), with a
// side-to-side wiggle added on top.
export const ARM_WAVE = { R: { x: -0.4, y: 0.0, z: 2.4 } };
// Both arms flung up-and-out to the sides for a big stretch (mirrors of each other):
// angled up to read as a reach, but splayed wide so the hands clear the face rather
// than crowding it, and low enough to stay in front of the (enlarged) back leaf.
export const ARM_STRETCH = {
  L: { x: -0.3, y: -0.2, z: -2.68 },
  R: { x: -0.3, y: 0.2, z: 2.68 },
};

// One articulated arm: a shoulder pivot Group with the capsule hanging from it and a
// `hand` Group at the wrist that props (joint / lighter) can be parented to.
function makeArm(track, mat, side, shoulder) {
  const pivot = new THREE.Group();
  pivot.position.set(...shoulder);
  const rest = ARM_REST[side];
  pivot.rotation.set(rest.x, rest.y, rest.z);

  const geo = new THREE.CapsuleGeometry(0.16, ARM_LEN, 4, 10);
  track.geometries.push(geo);
  const arm = new THREE.Mesh(geo, mat);
  arm.position.y = -(ARM_LEN / 2 + 0.16); // top of the capsule sits at the pivot
  pivot.add(arm);

  const hand = new THREE.Group();
  hand.position.y = -(ARM_LEN + 0.2);
  const handGeo = new THREE.SphereGeometry(0.26, 12, 12);
  track.geometries.push(handGeo);
  hand.add(new THREE.Mesh(handGeo, mat));
  pivot.add(hand);

  return { pivot, hand };
}

function makeLimbs(track) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.leafDark, roughness: 0.7 });
  track.materials.push(mat);

  // Arms only — Bud's a floating leaf buddy; he just needs hands to spark up.
  const left = makeArm(track, mat, 'L', [-0.95, 0.0, 0.25]);
  const right = makeArm(track, mat, 'R', [0.95, 0.0, 0.25]);
  group.add(left.pivot, right.pivot);

  return { group, armL: left.pivot, armR: right.pivot, handL: left.hand, handR: right.hand };
}

// A rolled joint held in the fist: paper body + a tip whose emissive glows when lit.
function makeJoint(track) {
  const group = new THREE.Group();
  const paperMat = new THREE.MeshStandardMaterial({ color: '#f4f1e6', roughness: 0.85 });
  track.materials.push(paperMat);
  const bodyGeo = new THREE.CylinderGeometry(0.05, 0.056, 0.4, 10);
  track.geometries.push(bodyGeo);
  const stick = new THREE.Mesh(bodyGeo, paperMat);
  stick.position.y = 0.2;
  group.add(stick);

  const tipMat = new THREE.MeshStandardMaterial({ color: '#3a3633', emissive: '#ff5a1f', emissiveIntensity: 0 });
  track.materials.push(tipMat);
  const tipGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10);
  track.geometries.push(tipGeo);
  const tip = new THREE.Mesh(tipGeo, tipMat);
  tip.position.y = 0.43;
  group.add(tip);

  // Angle the joint out of the fist so that — once the right arm reaches its SMOKE
  // pose — the lit tip points forward past the lips. Solved against the live rig.
  group.position.set(0, 0.08, 0.14);
  group.rotation.set(0.501, -0.242, -0.889);
  return { group, tipMaterial: tipMat };
}

// A little lighter held in the other fist, with a flame that flickers when sparked.
function makeLighter(track) {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 });
  track.materials.push(caseMat);
  const caseGeo = new THREE.BoxGeometry(0.16, 0.28, 0.1);
  track.geometries.push(caseGeo);
  const body = new THREE.Mesh(caseGeo, caseMat);
  body.position.y = 0.1;
  group.add(body);

  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffb12e', transparent: true, opacity: 0.95 });
  track.materials.push(flameMat);
  const flameGeo = new THREE.ConeGeometry(0.07, 0.22, 10);
  track.geometries.push(flameGeo);
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.y = 0.34;
  flame.visible = false;
  group.add(flame);

  group.position.set(0, 0.06, 0.12);
  // Aimed (against the live rig) so the flame meets the joint tip in the SMOKE pose.
  group.rotation.set(1.858, 0.766, 0.585);
  return { group, flame, flameMaterial: flameMat };
}

// A chunky chocolate-chip cookie for the munchies emote. Lives in the LEFT fist in
// the lighter's spot; BudThree swaps their visibility while he snacks.
function makeSnack(track) {
  const group = new THREE.Group();
  const doughMat = new THREE.MeshStandardMaterial({ color: '#d9a05b', roughness: 0.9 });
  track.materials.push(doughMat);
  const doughGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.12, 16);
  track.geometries.push(doughGeo);
  const cookie = new THREE.Mesh(doughGeo, doughMat);
  group.add(cookie);

  const chipMat = new THREE.MeshStandardMaterial({ color: '#4a2c17', roughness: 0.6 });
  track.materials.push(chipMat);
  const chipGeo = new THREE.SphereGeometry(0.06, 8, 8);
  track.geometries.push(chipGeo);
  const spots = [[0.14, 0.07, 0.08], [-0.11, 0.07, -0.14], [0.03, 0.07, -0.03], [-0.16, 0.07, 0.12], [0.18, 0.07, -0.11]];
  for (const [x, y, z] of spots) {
    const chip = new THREE.Mesh(chipGeo, chipMat);
    chip.position.set(x, y, z);
    cookie.add(chip);
  }

  // Same fist slot as the lighter, tilted so the cookie face points at the mouth
  // when the left arm is up in the smoke/munch pose.
  group.position.set(0, 0.06, 0.12);
  group.rotation.set(1.6, 0.5, 0.4);
  group.visible = false;
  return { group, cookie };
}

// Cool-guy sunglasses that slide down over the eyes when the grow is dialed in.
// Built in FACE space (the eyes sit at ±0.62, 0.3), floating just in front of the
// eyeballs. BudThree slides them in from above and hides them when not earned.
function makeShades(track) {
  const group = new THREE.Group();
  const lensMat = new THREE.MeshStandardMaterial({ color: '#101014', roughness: 0.25, metalness: 0.35 });
  track.materials.push(lensMat);

  const lensGeo = new THREE.CircleGeometry(0.56, 24);
  track.geometries.push(lensGeo);
  const left = new THREE.Mesh(lensGeo, lensMat);
  left.position.set(-0.62, 0.3, 0.62);
  const right = new THREE.Mesh(lensGeo, lensMat);
  right.position.set(0.62, 0.3, 0.62);
  group.add(left, right);

  const barGeo = new THREE.BoxGeometry(0.55, 0.09, 0.05);
  track.geometries.push(barGeo);
  const bridge = new THREE.Mesh(barGeo, lensMat);
  bridge.position.set(0, 0.42, 0.62);
  group.add(bridge);

  group.visible = false;
  return { group };
}

// A jaunty party hat perched on the leaf for celebrations: striped cone + pompom.
function makePartyHat(track) {
  const group = new THREE.Group();
  const coneMat = new THREE.MeshStandardMaterial({ color: '#e857a1', roughness: 0.55 });
  track.materials.push(coneMat);
  const coneGeo = new THREE.ConeGeometry(0.42, 0.95, 18);
  track.geometries.push(coneGeo);
  const cone = new THREE.Mesh(coneGeo, coneMat);
  group.add(cone);

  const bandMat = new THREE.MeshStandardMaterial({ color: '#ffd23f', roughness: 0.55 });
  track.materials.push(bandMat);
  const bandGeo = new THREE.ConeGeometry(0.29, 0.66, 18);
  track.geometries.push(bandGeo);
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.position.y = 0.16;
  group.add(band);

  const pomMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  track.materials.push(pomMat);
  const pomGeo = new THREE.SphereGeometry(0.13, 10, 10);
  track.geometries.push(pomGeo);
  const pom = new THREE.Mesh(pomGeo, pomMat);
  pom.position.y = 0.52;
  group.add(pom);

  // Perched up and slightly right on the big back leaf, tilted for maximum jaunt.
  group.position.set(0.55, 2.3, 0.15);
  group.rotation.z = -0.35;
  group.visible = false;
  return { group };
}

// A small pool of rising smoke puffs (each its own material so opacity is independent).
function makeSmoke(track, count = 8) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.16, 10, 10);
  track.geometries.push(geo);
  const puffs = [];
  for (let i = 0; i < count; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: '#d9ddd6', transparent: true, opacity: 0, depthWrite: false });
    track.materials.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    m.userData = { active: false, age: 0, life: 1.7, vx: 0 };
    group.add(m);
    puffs.push(m);
  }
  return { group, puffs };
}

// A soft radial-gradient texture used for the ground shadow.
function makeShadow(track) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  track.textures.push(tex);

  const geo = new THREE.PlaneGeometry(3.4, 3.4);
  track.geometries.push(geo);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  track.materials.push(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;       // lie flat on the ground
  mesh.position.y = -2.2;
  return mesh;
}

// Floating "Zzz" sprites for when Bud dozes off. A few planes sharing a canvas-drawn
// 'z' texture; BudThree fades + drifts them upward while he's asleep.
function makeZzz(track) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d7ecdb';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('z', 32, 36);
  const tex = new THREE.CanvasTexture(canvas);
  track.textures.push(tex);

  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.7, 0.7);
  track.geometries.push(geo);
  const sprites = [];
  for (let i = 0; i < 3; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    track.materials.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    group.add(mesh);
    sprites.push(mesh);
  }
  group.position.set(0.9, 2.4, 0.5); // up and to the right of his head
  return { group, sprites };
}

// Assemble the whole character. `track` accumulates disposables.
export function buildLush() {
  const track = { geometries: [], materials: [], textures: [] };

  const root = new THREE.Group();
  const body = new THREE.Group();   // everything that breathes/leans together
  root.add(body);

  const leaf = makeLeaf(track);
  body.add(leaf);

  const limbs = makeLimbs(track);
  body.add(limbs.group);

  // Smoking props: joint in the right fist, lighter in the left. The snack shares
  // the left fist — BudThree swaps lighter/snack visibility during the munch emote.
  const joint = makeJoint(track);
  limbs.handR.add(joint.group);
  const lighter = makeLighter(track);
  limbs.handL.add(lighter.group);
  const snack = makeSnack(track);
  limbs.handL.add(snack.group);
  // Smoke rises in body space so it tracks Bud but isn't squashed by the breathe.
  const smoke = makeSmoke(track);
  body.add(smoke.group);

  // Face group sits in front of the lower leaf.
  const face = new THREE.Group();
  face.position.set(0, 0.35, 0.55);
  body.add(face);

  const left = makeEye(track, -1);
  const right = makeEye(track, 1);
  left.group.position.set(-0.62, 0.3, 0);
  right.group.position.set(0.62, 0.3, 0);
  face.add(left.group, right.group);

  const mouth = makeMouth(track);
  mouth.group.position.set(0, -0.55, 0.15);
  face.add(mouth.group);

  // Accessories (hidden until earned): shades over the eyes, party hat up top.
  const shades = makeShades(track);
  face.add(shades.group);
  const hat = makePartyHat(track);
  body.add(hat.group);

  const shadow = makeShadow(track);
  root.add(shadow);

  const zzz = makeZzz(track);
  body.add(zzz.group);

  const dispose = () => {
    track.geometries.forEach((g) => g.dispose());
    track.materials.forEach((m) => m.dispose());
    track.textures.forEach((t) => t.dispose());
    track.geometries.length = 0;
    track.materials.length = 0;
    track.textures.length = 0;
  };

  return {
    root, body, leaf, face, eyes: [left, right], mouth, shadow,
    limbs, joint, lighter, snack, smoke, zzz, shades, hat,
    dispose,
  };
}
