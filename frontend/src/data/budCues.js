// The shared vocabulary between Bud's brain (BudMascot, the bus) and his body
// (BudThree). A cue is a short, named, one-shot piece of body language the
// brain asks for and the rig performs; the rig owns HOW it looks, the brain
// owns WHEN it happens. Both sides import this table so a cue cannot exist
// on one side only (CODING-PRACTICES 5.0: a name nobody consumes is inert).
//
// `dur` is the nominal seconds the rig should take; `interrupts` says whether
// the cue may cut into an idle emote already playing (a wince must; a hum
// must not). `sound` names the utils/sound.js function to play at the start,
// or null.

export const CUES = {
  // --- reactions to what the user is doing (MR-63 emits, MR-64 performs) ---
  peek:      { dur: 1.6, interrupts: true,  sound: null,     note: 'leans in and squints at the form being typed in' },
  nod:       { dur: 1.0, interrupts: true,  sound: null,     note: 'approving nod, small smile (a reading inside its band)' },
  wince:     { dur: 1.2, interrupts: true,  sound: 'huh',    note: 'flinch back, brows knit (a reading outside its band)' },
  cheer:     { dur: 1.8, interrupts: true,  sound: 'pop',    note: 'arms up, bounce (a save succeeded)' },
  sulk:      { dur: 2.2, interrupts: true,  sound: null,     note: 'droops, looks away (something was deleted)' },
  shrug:     { dur: 1.6, interrupts: true,  sound: 'huh',    note: 'both arms out, lost look ("I have no idea what is going on")' },
  facepalm:  { dur: 1.8, interrupts: true,  sound: null,     note: 'hand to face (a validation error on submit)' },
  // --- idle life (MR-68) ---
  lookAround:{ dur: 2.4, interrupts: false, sound: null,     note: 'glances left, right, up, as if he heard something' },
  scratch:   { dur: 1.6, interrupts: false, sound: null,     note: 'scratches the side of his head' },
  hum:       { dur: 3.0, interrupts: false, sound: 'hum',    note: 'sways gently, mouth closed, humming' },
  munchies:  { dur: 3.4, interrupts: false, sound: 'chomp',  note: 'the existing snack bit, biased toward noon and late night' },
  yawn:      { dur: 2.6, interrupts: false, sound: 'yawn',   note: 'the existing stretch/yawn, biased toward late evening' },
  watch:     { dur: 1.8, interrupts: false, sound: null,     note: 'looks at an imaginary watch on his wrist' },
  welcomeBack:{ dur: 2.0, interrupts: true, sound: 'pop',    note: 'perks up and waves when the tab regains focus after a long absence' },
  // --- locomotion (MR-65) ---
  walk:      { dur: 0,   interrupts: true,  sound: 'steps',  note: 'looping bob + arm swing while his position is being animated; dur 0 = until stopped' },
  land:      { dur: 0.8, interrupts: true,  sound: null,     note: 'settle squash when a walk ends' },
  point:     { dur: 2.0, interrupts: true,  sound: null,     note: 'one arm out toward the thing he walked to' },
};

export const CUE_NAMES = Object.keys(CUES);

// Validate a cue request before it reaches the rig. Returns the cue record or
// null; the rig ignores null rather than guessing.
export function cueFor(name) {
  return Object.prototype.hasOwnProperty.call(CUES, name) ? CUES[name] : null;
}

// Bus event names the app emits (MR-63) and the mascot maps to cues (MR-62).
// Payloads: { field, value, status } for readings; { kind } for saves/deletes.
export const BUD_EVENTS = {
  FORM_FOCUS: 'form:focus',       // user started filling a log form
  FORM_READING: 'form:reading',   // { field: 'ph'|'ec'|..., value, status: 'ok'|'warn'|'out'|'unknown' }
  SAVE_OK: 'save:ok',             // { kind: 'log'|'plant'|'schedule'|'reservoir' }
  SAVE_ERROR: 'save:error',       // { kind, message }
  DELETE: 'delete',               // { kind }
  TAB: 'tab',                     // { tab }
  APP_RETURN: 'app:return',       // { awaySeconds }
};

export const BUD_EVENT_NAMES = Object.values(BUD_EVENTS);
