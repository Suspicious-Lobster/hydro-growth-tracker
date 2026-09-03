// MR-66: free-text chat with Bud. Given whatever the user typed plus the same
// snapshot the click-menu (`answerQuestion`, assistantTips.js) already uses,
// pick the first matching intent, pull one real fact out of the snapshot, and
// compose it through the active voice (budVoice.js) so towelie stays flavorful
// and clean stays flavor-free. Pure, DOM-free, deterministic (no Date.now()
// inside — `now` is injected).

import { latestLog, currentHeight, growthRate, totalGrowth } from '../utils/stats';
import { harvestCountdown, careStreak } from '../utils/trends';
import { getProfile, getStageGuidance } from './recommendations';
import { feedingStatus } from '../utils/feeding';
import { parseLocalDate } from '../utils/dates';
import { compose, seedFrom } from './budVoice';

// Shared fact for every intent below when no plant is selected — a single
// literal so callers/tests can rely on the exact wording.
const NO_PLANT_FACT = "Pick a plant first and I'll tell you.";

const noPlantReply = () => ({ fact: NO_PLANT_FACT, expression: 'idle', cue: null, voiceKey: undefined });

// -------------------------------- helpers --------------------------------- //

const plantName = (p) => (p && p.name) || 'your plant';

function reservoirAgeDays(input, now) {
  const newestChange = (input.reservoirEvents || []).find((e) => e && e.kind === 'change');
  if (!newestChange) return null;
  const changedAt = parseLocalDate(newestChange.date);
  if (!changedAt) return null;
  return Math.floor((now - changedAt.getTime()) / 86400000);
}

function dueSchedule(input, now) {
  return (input.schedules || []).find((s) => s && s.active !== false && feedingStatus(s, new Date(now)).due);
}

// One real number, drawn from whatever the snapshot actually has, for the
// fallback intent — with or without a selected plant.
function oneRealFact(input) {
  const logs = input.logs || [];
  if (input.selectedPlant) {
    const latest = latestLog(logs);
    if (latest && latest.ph != null && latest.ph !== '') return `your last pH was ${latest.ph}`;
    if (latest && latest.ec != null && latest.ec !== '') return `your last EC was ${latest.ec}`;
    if (latest && latest.height != null && latest.height !== '') return `your last height was ${latest.height}cm`;
  }
  return `you have ${logs.length} logs`;
}

// ------------------------------- intents ----------------------------------- //

// Ordered: first regex match wins. The last entry matches everything, so
// `INTENTS.find(...)` never comes back empty — it's the shrug fallback.
export const INTENTS = [
  {
    key: 'ph',
    test: /ph|acid/i,
    reply(input) {
      if (!input.selectedPlant) return noPlantReply();
      const latest = latestLog(input.logs);
      const range = getProfile(input.selectedPlant.species)?.phRange;
      const value = latest && latest.ph != null && latest.ph !== '' ? parseFloat(latest.ph) : null;
      if (value == null || Number.isNaN(value) || !range) {
        return { fact: `No pH reading logged for ${plantName(input.selectedPlant)} yet.`, expression: 'idle', cue: null, voiceKey: 'reminderPrefix' };
      }
      const outside = value < range.min || value > range.max;
      return {
        fact: `${plantName(input.selectedPlant)}'s last pH was ${value}; the band is ${range.min}-${range.max}.`,
        expression: outside ? 'alert' : 'happy',
        cue: outside ? 'wince' : 'nod',
        voiceKey: outside ? 'alertPrefix' : 'reminderPrefix',
      };
    },
  },
  {
    key: 'ec',
    test: /ec\b|ppm|feed|nutrient/i,
    reply(input, ctx) {
      if (!input.selectedPlant) return noPlantReply();
      const due = dueSchedule(input, ctx.now);
      if (due) {
        return {
          fact: `${plantName(input.selectedPlant)} is due for a feed (${due.nutrient_type || 'nutrients'}).`,
          expression: 'alert',
          cue: 'wince',
          voiceKey: 'reminderPrefix',
        };
      }
      const latest = latestLog(input.logs);
      const ecRange = getStageGuidance(input.selectedPlant.species, input.stage)?.ec;
      const value = latest && latest.ec != null && latest.ec !== '' ? parseFloat(latest.ec) : null;
      if (value == null || Number.isNaN(value) || !ecRange) {
        return { fact: `No feeding schedule or EC reading for ${plantName(input.selectedPlant)} yet.`, expression: 'idle', cue: null, voiceKey: 'reminderPrefix' };
      }
      const outside = value < ecRange.min || value > ecRange.max;
      return {
        fact: `${plantName(input.selectedPlant)}'s last EC was ${value}; target is ${ecRange.min}-${ecRange.max}.`,
        expression: outside ? 'alert' : 'happy',
        cue: outside ? 'wince' : 'nod',
        voiceKey: outside ? 'alertPrefix' : 'reminderPrefix',
      };
    },
  },
  {
    key: 'height',
    test: /height|tall|grow/i,
    reply(input) {
      if (!input.selectedPlant) return noPlantReply();
      const h = currentHeight(input.logs);
      const rate = growthRate(input.logs);
      const total = totalGrowth(input.logs);
      return {
        fact: `${plantName(input.selectedPlant)} is ~${h}cm tall, growing at ~${rate}cm/day (+${total}cm total).`,
        expression: 'happy',
        cue: 'nod',
        voiceKey: 'milestone',
      };
    },
  },
  {
    key: 'harvest',
    test: /harvest|when|ready/i,
    reply(input, ctx) {
      if (!input.selectedPlant) return noPlantReply();
      const hc = harvestCountdown(input.logs, input.selectedPlant.species, ctx.now);
      if (!hc) {
        return {
          fact: `${plantName(input.selectedPlant)} isn't in late flowering yet — too early to say.`,
          expression: 'idle',
          cue: null,
          voiceKey: 'reminderPrefix',
        };
      }
      if (hc.ready) {
        return {
          fact: `${plantName(input.selectedPlant)} is ready to harvest!`,
          expression: 'celebrating',
          cue: 'cheer',
          voiceKey: 'harvest',
        };
      }
      return {
        fact: `${plantName(input.selectedPlant)} should be ready in about ${hc.days} days (${hc.low}-${hc.high}).`,
        expression: 'happy',
        cue: 'nod',
        voiceKey: 'harvest',
      };
    },
  },
  {
    key: 'reservoir',
    test: /water|reservoir|change/i,
    reply(input, ctx) {
      if (!input.selectedPlant) return noPlantReply();
      const age = reservoirAgeDays(input, ctx.now);
      if (age == null) {
        return { fact: `No reservoir change logged for ${plantName(input.selectedPlant)} yet.`, expression: 'idle', cue: null, voiceKey: 'reservoir' };
      }
      const stale = age >= 14;
      return {
        fact: `${plantName(input.selectedPlant)}'s reservoir was last changed ${age} day${age === 1 ? '' : 's'} ago.`,
        expression: stale ? 'alert' : 'happy',
        cue: stale ? 'wince' : 'nod',
        voiceKey: 'reservoir',
      };
    },
  },
  {
    key: 'climate',
    test: /humid|temp|vpd/i,
    reply(input) {
      if (!input.selectedPlant) return noPlantReply();
      const latest = latestLog(input.logs);
      if (!latest) {
        return { fact: `No readings logged for ${plantName(input.selectedPlant)} yet.`, expression: 'idle', cue: null, voiceKey: 'reminderPrefix' };
      }
      const vpdBit = input.vpd != null ? `, VPD ${input.vpd}kPa` : '';
      const outOfRange = (input.alerts || []).some((a) => ['air_temp', 'humidity', 'vpd'].includes(a && a.key) && a.status === 'out');
      return {
        fact: `${plantName(input.selectedPlant)}: ${latest.air_temp}° air, ${latest.humidity}% humidity${vpdBit}.`,
        expression: outOfRange ? 'alert' : 'happy',
        cue: outOfRange ? 'wince' : 'nod',
        voiceKey: outOfRange ? 'alertPrefix' : 'reminderPrefix',
      };
    },
  },
  {
    key: 'badge',
    test: /badge|streak/i,
    reply(input, ctx) {
      const streak = careStreak(input.logs || [], ctx.now);
      const name = input.selectedPlant ? plantName(input.selectedPlant) : 'You';
      const fact = streak > 0
        ? `${name}'s current logging streak is ${streak} day${streak === 1 ? '' : 's'}.`
        : `${name === 'You' ? 'You' : name} don't have a logging streak going yet — a log today would start one.`;
      return {
        fact,
        expression: streak > 0 ? 'happy' : 'idle',
        cue: streak >= 3 ? 'cheer' : null,
        voiceKey: 'badge',
      };
    },
  },
  {
    key: 'greeting',
    test: /\bhello\b|\bhi\b|\bhey\b/i,
    reply(input) {
      const fact = input.selectedPlant ? `${plantName(input.selectedPlant)} says hi too. Probably.` : 'Hey there!';
      return { fact, expression: 'happy', cue: null, voiceKey: 'greeting' };
    },
  },
  {
    key: 'deflect',
    test: /high|smoke|joint/i,
    reply(input, ctx) {
      const alert = (input.alerts || []).find((a) => a && a.range);
      const due = dueSchedule(input, ctx.now);
      let fact;
      if (alert) {
        fact = `${alert.label} is out of range (${alert.range.min}-${alert.range.max}).`;
      } else if (due) {
        fact = `${due.nutrient_type || 'A feed'} is due.`;
      } else {
        fact = 'your readings look fine.';
      }
      return {
        fact,
        expression: alert ? 'alert' : 'happy',
        cue: alert ? 'wince' : 'nod',
        voiceKey: 'catchphrase',
      };
    },
  },
  {
    key: 'fallback',
    test: /[\s\S]*/,
    reply(input) {
      return {
        fact: `Not sure what you mean, but ${oneRealFact(input)}.`,
        expression: 'idle',
        cue: 'shrug',
        voiceKey: 'tangent',
      };
    },
  },
];

// ------------------------------- entry point ------------------------------- //

// answer(text, input, { voice, now }) -> { text, expression, cue }
export function answer(text, input = {}, opts = {}) {
  const { voice = 'towelie', now = 0 } = opts;
  const raw = String(text == null ? '' : text);
  const lower = raw.toLowerCase();
  const ctx = { now };
  const intent = INTENTS.find((i) => i.test.test(lower));
  const built = intent.reply(input, ctx);
  return {
    text: compose(voice, built.voiceKey, built.fact, { seed: seedFrom(raw) }),
    expression: built.expression,
    cue: built.cue,
  };
}
