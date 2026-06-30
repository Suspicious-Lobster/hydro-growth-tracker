// Bud's first-run guided tour. Pure data + a tiny completion helper so the
// orchestration in BudMascot stays simple and unit-testable.
//
// Each step: { id, text, expression, tab?, primary, optional?, autoCompleteOn? }
//   primary        — 'next' | 'goto' | 'finish' (what the main button does)
//   tab            — which app tab "Take me there" switches to (goto steps)
//   autoCompleteOn — 'plantAdded' | 'scheduleAdded' — advance automatically when the
//                    matching collection grows (so doing the thing moves the tour on)
//   optional       — the secondary button reads "Skip this" instead of "Maybe later"

export const TOUR_STEPS = [
  {
    id: 'welcome',
    expression: 'happy',
    primary: 'next',
    text: "Hey, I'm Bud! 🌿 New around here? Let me show you the ropes — takes about 20 seconds.",
  },
  {
    id: 'plant',
    expression: 'idle',
    tab: 'plants',
    primary: 'goto',
    autoCompleteOn: 'plantAdded',
    text: "First up — let's add your first plant. Hit “Take me there” and give it a name. 🌱",
  },
  {
    id: 'feeding',
    expression: 'idle',
    tab: 'feeding',
    primary: 'goto',
    optional: true,
    autoCompleteOn: 'scheduleAdded',
    text: "Nice one! Want me to nag you about feedings? Set up a schedule here — or skip it, totally optional. 🍽️",
  },
  {
    id: 'prefs',
    expression: 'idle',
    tab: 'settings',
    primary: 'goto',
    text: "Last thing — pop into Settings to pick your units (°C/°F, cm/in) and theme whenever you like. ⚙️",
  },
  {
    id: 'done',
    expression: 'celebrating',
    primary: 'finish',
    text: "That's it — you're all set! 🎉 I'll keep an eye on your grow and chime in when it helps. Click me anytime to ask.",
  },
];

// Map an autoCompleteOn key to the collection whose growth completes the step.
const COUNT_KEY = { plantAdded: 'plants', scheduleAdded: 'schedules' };

// True when `step` should auto-advance: it has an autoCompleteOn trigger and that
// collection's count rose from prev -> counts. `prev`/`counts` are { plants, schedules }.
export function stepCompleted(step, prev, counts) {
  if (!step || !step.autoCompleteOn || !prev || !counts) return false;
  const key = COUNT_KEY[step.autoCompleteOn];
  return key ? counts[key] > prev[key] : false;
}
