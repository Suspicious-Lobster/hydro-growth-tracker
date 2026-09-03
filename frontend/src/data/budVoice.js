// Bud's personality tables. PURE data + a tiny composer — no React, no DOM.
//
// Every tip Bud says is `compose(voice, key, fact)`: a flavor line picked from
// a VOICES[voice][key] pool, glued to a factual clause. The factual clause
// (numbers, ranges, plant names) NEVER lives in these tables — that's the
// whole point: a joke can be rewritten any time without losing the pH band
// or the plant's name, because those are injected by the caller (assistantTips.js).
//
// Two voices ship: 'towelie' (South Park's forgetful, over-helpful talking
// towel — spacey, drifts mid-thought, occasionally offers you a smoke, then
// snaps back to something genuinely useful) and 'clean' (short, warm, no
// drug references, no tangents). Both define the SAME keys so the composer
// never has to special-case a voice.

// The complete set of keys every voice must define. buildCandidates /
// answerQuestion pick one of these per tip; a pool may be empty (e.g. clean
// has no tangents) but the key itself must exist.
export const VOICE_KEYS = [
  'greeting',
  'idle',
  'alertPrefix',
  'reminderPrefix',
  'milestone',
  'harvest',
  'drift',
  'reservoir',
  'badge',
  'tangent',
  'catchphrase',
];

// Towelie's catchphrases — his signature lines. Reused as the alertPrefix
// pool too, so every composed alert is guaranteed to carry a marker (the
// thing assistantTips.test.js checks for). No numbers, no plant names: these
// are pure flavor, always paired with a fact clause supplied by the caller.
const TOWELIE_CATCHPHRASES = [
  "I have no idea what's going on. But this I know:",
  'You wanna get high? ...no? Okay, then',
  'Oh man. Oh man.',
  'Towel tip:',
  "Don't forget to bring a towel. But more importantly,",
  'Whoa, dude. Okay, seriously though:',
  "This one's important, so pay attention. Or don't. Either way:",
  'Honestly, I forgot what I was doing, but here\'s the deal:',
];

// Towelie loses the thread mid-sentence, then finds it again. These stand
// alone (no fact glued on) — assistantTips.js doesn't call compose with
// 'tangent' directly today, but the pool exists per spec and is exercised by
// budVoice.test.js. Kept generic on purpose: no plant names, no numbers.
const TOWELIE_TANGENTS = [
  'Wait, what were we... oh right.',
  'Hold on, hold on. What was I saying?',
  'Sorry, got distracted by a shiny rock. Anyway.',
  "Whoa, deja vu. Or not. Who's to say.",
  'Where was I? Oh yeah.',
  'Wait, are we still talking about the plant? I love plants.',
  'Hang on, I think I heard something. Probably nothing.',
  "Man, I really gotta stop losing my train of thought.",
  'Oh hey, a butterfly. Wait, no. Anyway.',
  "I zoned out for a sec. What'd I miss?",
  'Wait, what was the question again?',
  'My bad, I drifted off there. Okay, focus.',
  'Huh, weird, I thought I already said this.',
  'Anyway, where were we? Right.',
];

export const VOICES = {
  towelie: {
    greeting: [
      "Whoa, hey, you're back. I wasn't expecting... anyone. Or was I?",
      'Oh hey! Long time no— wait, was it long? Time is weird, man.',
      "Duuude, good to see you. Or is it? I never can tell.",
      'Yo. I was just... doing something. Probably plant stuff.',
    ],
    idle: [
      'Hey, you ever just stare at a plant and forget what you were doing? Same.',
      'I was gonna say something important. It\'ll come to me.',
      'Logging stuff is good. I think. I forget why, but it\'s good.',
      'You wanna get high? ...kidding. Mostly. Anyway, check your readings.',
      'Whoa, time flies. Or does it crawl? I lose track.',
      'I have no idea what\'s going on. But logging helps, I think.',
      'Oh man, I totally spaced. What was I saying? Something about plants.',
      'Reservoirs get funky if you forget \'em. Like my brain, but slower.',
      "Hang in there. Or don't. I mean, do. Keep tracking, though.",
      'I was gonna tell you a joke, but I forgot the ending. Typical.',
      "Wait, are we still doing the plant thing? Cool, cool, I'm into it.",
      'Every log is like a little memory. Unlike most of mine.',
      'Small steps, big leaves. Or was it the other way around? Keep going.',
      "I zoned out again. But hey, you're still here. That's nice.",
    ],
    // Same content as the catchphrases: guarantees a composed alert always
    // contains a marker for the towelie voice.
    alertPrefix: TOWELIE_CATCHPHRASES,
    reminderPrefix: [
      "Don't forget to bring a towel... wait, I mean,",
      'Don\'t forget to grab snacks... no, hold on, I mean,',
      'You should really remember to bring a lighter... I mean,',
      'Remember to bring your... uh, I mean,',
    ],
    milestone: [
      'Whoa, dude, check it out:',
      'Duuude, this is huge:',
      'Okay, focus, this matters:',
      'Hey, good news, for real:',
    ],
    harvest: [
      'Whoa. Whoa whoa whoa.',
      'Dude. This is the moment.',
      "Okay, I'm actually excited, listen:",
    ],
    drift: [
      'Hey, heads up, before I forget:',
      'Wait, I noticed something, hang on:',
      "Okay, don't panic, but:",
    ],
    reservoir: [
      'Reservoirs, man. They need love too.',
      "Speaking of water, and I might be projecting, but:",
      'Hey, quick thing about the water:',
    ],
    badge: [
      'Whoa, achievement unlocked, or whatever:',
      'Dude, look at you go:',
      'Okay, this deserves a moment:',
    ],
    tangent: TOWELIE_TANGENTS,
    catchphrase: TOWELIE_CATCHPHRASES,
  },
  clean: {
    greeting: ['Welcome back.', 'Good to see you.', 'Hi there.'],
    idle: [
      'A quick check-in keeps your grow on track.',
      'Consistent logging pays off.',
      'Everything looks steady.',
      'A few minutes of tracking now saves time later.',
      'Small, regular updates make the biggest difference.',
      'Keep up the good habits.',
    ],
    alertPrefix: ['Heads up:', 'Note:', 'Please check:'],
    reminderPrefix: ['Reminder:', 'Friendly reminder:', 'Quick note:'],
    milestone: ['Nice work:', 'Milestone reached:', 'Good progress:'],
    harvest: ['Harvest time:', 'Ready to harvest:'],
    drift: ['Trend alert:', 'Worth a look:'],
    reservoir: ['Reservoir note:', 'Water reminder:'],
    badge: ['Achievement unlocked:', 'New badge:'],
    tangent: [],
    catchphrase: [],
  },
};

// Markers that identify a line as unmistakably Towelie. Used by tests (and
// available to callers) to prove a clean-voice string never leaks his voice.
export const TOWELIE_MARKERS = TOWELIE_CATCHPHRASES;

// Falls back to towelie for any unknown/undefined voice name, so an older
// caller (or corrupt localStorage) never crashes — it just gets the default.
export function getVoice(name) {
  return VOICES[name] || VOICES.towelie;
}

// Small deterministic string hash -> non-negative int, so callers can turn a
// stable id (a tip id, a plant+key pair) into a stable pool index without
// pulling in Math.random or the wall clock.
export function seedFrom(value) {
  const s = String(value);
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Compose a line of Bud's dialogue: a voice-flavored prefix + the factual
// clause, verbatim. `seed` picks deterministically within the pool (same
// seed -> same line, every time — no Date.now(), no Math.random here).
export function compose(voiceName, key, fact, opts = {}) {
  const voice = getVoice(voiceName);
  const pool = voice[key] || [];
  const factStr = fact == null ? '' : String(fact);
  if (!pool.length) return factStr;
  const seed = Number.isFinite(opts.seed) ? Math.abs(Math.floor(opts.seed)) : 0;
  const line = pool[seed % pool.length];
  return factStr ? `${line} ${factStr}`.trim() : line;
}
