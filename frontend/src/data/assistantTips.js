// Bud's brain: a PURE, DOM-free tip engine. Given a snapshot of what the user is
// looking at (tab, selected plant, its alerts/logs/stage), it picks the single
// most relevant thing for the mascot to say — or nothing. No React, no DOM, no
// Date.now() inside (the caller injects `now`), so it's deterministic and unit
// testable alongside ranges.test.js / stats.test.js.
//
// Tone: playful, lightly cannabis-punny, family-friendly. All copy lives here.

import { totalGrowth, daysTracked, latestLog, currentHeight, sortLogsByDate } from '../utils/stats';
import { stageLabel, getStageGuidance, getProfile, inferStage } from './recommendations';
import { feedingStatus } from '../utils/feeding';
import { phTrend, driftAlerts, growthStall, strongGrowth, isHarvestWindow, harvestCountdown, careStreak } from '../utils/trends';
import { BADGES } from '../utils/achievements';
import { parseLocalDate } from '../utils/dates';
import { GROWTH_STAGES } from './plantKnowledge';

// Lifecycle order used to tell whether an inferred stage change is a step
// forward (worth celebrating) rather than a correction/backslide.
const STAGE_ORDER = Object.values(GROWTH_STAGES);

// Higher number = more important. Alerts always outrank chit-chat. Reminders
// (feeding/logging) sit just below alerts; insights (trends) below milestones.
export const TIP_KINDS = { alert: 4, reminder: 3.5, milestone: 3, insight: 2.5, contextual: 2, idle: 1 };

// Don't pester about a fresh log: only nudge once it's been this many days.
const LOG_NUDGE_DAYS = 4;

// Minimum gap between non-alert tips, so Bud is friendly, not naggy.
export const RATE_LIMIT_MS = 60 * 1000;

// A reservoir sitting unchanged this long (or longer) earns a nudge.
export const RESERVOIR_STALE_DAYS = 14;

const plantKey = (plant) => (plant && plant.id != null ? plant.id : 'none');

// ----------------------------- copy templates ----------------------------- //

// Punny one-liners per out-of-range measurement. Falls back to a generic line.
const ALERT_COPY = {
  ph: (a) => `Heads up — pH is drifting ${a.value} out of the happy zone (aim ${a.range.min}–${a.range.max}). A little tweak and your buds will thank you. 🌿`,
  ec: (a) => `Your nutrient strength (EC ${a.value}) is off target (${a.range.min}–${a.range.max}). Let's not over- or under-feed these green friends.`,
  air_temp: (a) => `It's feeling ${a.value}° in here — comfy is ${a.range.min}–${a.range.max}°. Keep your plant chill (but not too chill).`,
  water_temp: (a) => `Reservoir's reading ${a.value}° (sweet spot ${a.range.min}–${a.range.max}°). Roots like it just right.`,
  humidity: (a) => `Humidity's at ${a.value}% — target's ${a.range.min}–${a.range.max}%. Dial it in to keep things breezy.`,
};

// Copy for driftAlerts entries — a reading that's been creeping toward (or is
// already sitting past) the edge of its band across several days, as opposed
// to today's point-in-time ALERT_COPY. `dir` is 'rising'/'falling' (trend) or
// 'high'/'low' (already out for two readings running, no clean trend to name).
const DRIFT_LABEL = { ph: 'pH', ec: 'EC' };
const DRIFT_DIR_WORDS = { rising: 'crept up', falling: 'crept down', high: 'stuck high', low: 'stuck low' };
const driftCopy = (d) => {
  const label = DRIFT_LABEL[d.key] || d.key;
  const dirWord = DRIFT_DIR_WORDS[d.dir] || d.dir;
  return `Heads up — ${label} drift: it's ${dirWord} and sitting outside the target band (aim ${d.min}–${d.max}). Worth a look before it wanders further. 🧪`;
};

export const IDLE_TIPS = [
  "Psst — logging height every few days makes your growth chart way more satisfying. 📈",
  "Stay hydrated, and so should your roots. 💧",
  "A quick pH check today saves a headache tomorrow.",
  "Talking to your plants is optional. Logging them is not. 😉",
  "Clean reservoir, happy roots. Just sayin'.",
  "Good things grow to those who track.",
  "Bud's motto: measure twice, harvest once. 🌿",
  "Fun fact: plants can't read your mind. Logs help. 📋",
  "A watched pot never boils, but a watered root always grows.",
  "Feeling leafy? That's a good sign, keep it up. 🍃",
  "Every log is a tiny time capsule for future-you. 🕰️",
  "Bud approves of consistent EC checks. Very responsible of you.",
  "Small daily habits, big leafy results. 🌱",
  "Reservoir water gets stale faster than yesterday's memes.",
];

// Logging-streak praise, biggest first (find() picks the highest earned tier).
const STREAK_MILESTONES = [14, 7, 3];
const STREAK_COPY = {
  3: (name) => `Three days straight of logging ${name} — Bud salutes the dedication. 🫡`,
  7: (name) => `A full WEEK of daily logs for ${name}. You're officially a grow nerd (compliment). 🏅`,
  14: (name) => `Fourteen-day logging streak on ${name}?! Legendary. The chart thanks you. 👑`,
};

// Chill little hellos for when Bud pops up (dashboard, no plant picked yet).
const GREETING_TIPS = [
  "Yooo, you're back. Garden's been chillin' — let's vibe. 🌿✌️",
  "Heyyy. Pull up a seat, let's see how the green's coming along. 😎",
  "What's good? Bud's been keeping an eye on things. All mellow. 🌱",
  "Welcome back, friend. Take it easy — we'll grow at our own pace. 🍃",
];

// --------------------------- candidate building --------------------------- //

// Build every tip that *could* apply right now, each with a stable id so the
// same condition always yields the same id (enables dedupe + "don't show again").
export function buildCandidates({ activeTab, selectedPlant, alerts = [], logs = [], stage, schedules = [], newBadges = [], reservoirEvents = [] } = {}, now = 0) {
  const candidates = [];
  const pid = plantKey(selectedPlant);

  // 0. Badge milestones — celebrate the first newly-earned badge, if any.
  if (newBadges.length) {
    const badge = BADGES.find((b) => b.id === newBadges[0]);
    if (badge) {
      candidates.push({
        id: `milestone:badge:${badge.id}`,
        kind: 'milestone',
        expression: 'celebrating',
        text: `Badge unlocked: ${badge.label}! ${badge.description} ${badge.emoji}`,
        priority: TIP_KINDS.milestone,
      });
    }
  }

  // 1. Alerts — highest priority, one per out-of-range reading.
  for (const a of alerts) {
    if (!a || !a.range) continue;
    const copy = ALERT_COPY[a.key] || ((x) => `${x.label} is out of range (${x.range.min}–${x.range.max}). Worth a look! 🌱`);
    candidates.push({
      id: `alert:${pid}:${a.key}:${a.status}`,
      kind: 'alert',
      expression: 'alert',
      text: copy(a),
      priority: TIP_KINDS.alert,
    });
  }

  // 2. Milestones — celebrate progress.
  if (selectedPlant) {
    if (logs.length === 1) {
      candidates.push({
        id: `milestone:first:${pid}`,
        kind: 'milestone',
        expression: 'celebrating',
        text: `First log for ${selectedPlant.name} is in the books — the journey begins! 🌱`,
        priority: TIP_KINDS.milestone,
      });
    }
    if (stage) {
      candidates.push({
        id: `milestone:stage:${pid}:${stage}`,
        kind: 'milestone',
        expression: 'celebrating',
        text: `${selectedPlant.name} just hit ${stageLabel(stage)} — looking dank! 🎉`,
        priority: TIP_KINDS.milestone,
      });
    }
    // Stage-change congratulation: compare the last two logs' OWN inferred
    // stages (not the caller-supplied `stage`), so this fires the moment a
    // fresh log crosses into a new stage, independent of the generic
    // "just hit X" milestone above.
    const recentLogs = sortLogsByDate(logs);
    if (recentLogs.length >= 2) {
      const [prevLog, newLog] = recentLogs.slice(-2);
      const prevStage = inferStage(selectedPlant.species, prevLog.height, prevLog.growth_stage);
      const newStage = inferStage(selectedPlant.species, newLog.height, newLog.growth_stage);
      if (prevStage && newStage && prevStage !== newStage
        && STAGE_ORDER.indexOf(newStage) > STAGE_ORDER.indexOf(prevStage)) {
        candidates.push({
          id: `milestone:stage:${pid}:${newStage}`,
          kind: 'milestone',
          expression: 'celebrating',
          text: `${selectedPlant.name} just leveled up to ${stageLabel(newStage)} — nice work! 🎉`,
          priority: TIP_KINDS.milestone,
        });
      }
    }
    const grown = totalGrowth(logs);
    const bucket = Math.floor(grown / 10) * 10;
    if (bucket >= 10) {
      candidates.push({
        id: `milestone:growth:${pid}:${bucket}`,
        kind: 'milestone',
        expression: 'celebrating',
        text: `${selectedPlant.name} has grown ${bucket}cm+ since you started tracking. Reach for the sky! 🌳`,
        priority: TIP_KINDS.milestone,
      });
    }
    const days = daysTracked(logs);
    const weekBucket = Math.floor(days / 7) * 7;
    if (weekBucket >= 7) {
      candidates.push({
        id: `milestone:days:${pid}:${weekBucket}`,
        kind: 'milestone',
        expression: 'happy',
        text: `${weekBucket} days of tracking ${selectedPlant.name} — that's dedication. 🙌`,
        priority: TIP_KINDS.milestone,
      });
    }
    // Care streaks — praise runs of consecutive logging days at 3 / 7 / 14.
    const streak = careStreak(logs, now);
    const streakHit = STREAK_MILESTONES.find((m) => streak >= m);
    if (streakHit) {
      candidates.push({
        id: `milestone:streak:${pid}:${streakHit}`,
        kind: 'milestone',
        expression: 'celebrating',
        text: STREAK_COPY[streakHit](selectedPlant.name),
        priority: TIP_KINDS.milestone,
      });
    }
  }

  // 3. Reminders + insights — need a selected plant with data.
  if (selectedPlant) {
    // Reservoir freshness — nudge once the newest change is stale, otherwise
    // (if a change has never been logged at all) gently invite a first one.
    const newestChange = reservoirEvents.find((e) => e && e.kind === 'change');
    if (newestChange) {
      const changedAt = parseLocalDate(newestChange.date);
      if (changedAt) {
        const age = Math.floor((now - changedAt.getTime()) / 86400000);
        if (age >= RESERVOIR_STALE_DAYS) {
          const weekBucket = Math.floor(age / 7);
          candidates.push({
            id: `reminder:reservoir:${pid}:${weekBucket}`,
            kind: 'reminder',
            expression: 'idle',
            text: `${selectedPlant.name}'s reservoir hasn't been changed in ${age} days — stale water makes roots grumpy. Time for a refresh? 💧`,
            priority: TIP_KINDS.reminder,
          });
        }
      }
    } else if (logs.length >= 5) {
      candidates.push({
        id: `contextual:reservoir-intro:${pid}`,
        kind: 'contextual',
        expression: 'idle',
        text: `Haven't seen a reservoir change logged for ${selectedPlant.name} yet — give it a go, roots love a fresh start. 💧`,
        priority: TIP_KINDS.contextual,
      });
    }

    // Feeding due (reuse the schedule timing util; `now` is injected for purity).
    const when = new Date(now);
    for (const s of schedules) {
      if (!s || s.active === false) continue;
      const st = feedingStatus(s, when);
      if (!st.due) continue;
      const label = s.nutrient_type ? `${s.nutrient_type} feed` : 'a feed';
      const text = st.overdue
        ? `${selectedPlant.name} is ${Math.abs(st.daysUntil)}d overdue for ${label} — let's not keep 'em waiting. 🍽️`
        : `${selectedPlant.name} is due for ${label} today. Mix it up! 🍽️`;
      candidates.push({
        id: `reminder:feed:${pid}:${s.id}`,
        kind: 'reminder', expression: 'happy', text, priority: TIP_KINDS.reminder,
      });
    }

    // Drift alerts — a reading creeping toward (or already past) the edge of its
    // band over several days. These rank at alert priority, but skip any key a
    // live point-in-time measurementAlert already covers, so Bud doesn't say two
    // things about the same reading at once.
    const phRange = getProfile(selectedPlant.species)?.phRange;
    const ecRange = getStageGuidance(selectedPlant.species, stage)?.ec;
    const alertKeys = new Set(alerts.map((a) => a && a.key));
    for (const d of driftAlerts(logs, { phRange, ecRange })) {
      if (alertKeys.has(d.key)) continue;
      candidates.push({
        id: `drift-${pid}-${d.key}-${d.dir}`,
        kind: 'alert',
        expression: 'alert',
        text: driftCopy(d),
        priority: TIP_KINDS.alert,
      });
    }

    // Trend insights — gentle, non-urgent observations.
    const ph = phTrend(logs, phRange);
    if (ph) {
      candidates.push({
        id: `insight:ph:${pid}:${ph.dir}`,
        kind: 'insight',
        expression: ph.leaving ? 'alert' : 'idle',
        text: ph.leaving
          ? `Keeping an eye on ${selectedPlant.name} — pH's been ${ph.dir} toward the edge of the zone (now ~${ph.value}). Worth a nudge. 🧪`
          : `${selectedPlant.name}'s pH has been steadily ${ph.dir} (now ~${ph.value}). Nothing urgent, just noticing. 🧪`,
        priority: TIP_KINDS.insight,
      });
    }
    const stall = growthStall(logs);
    if (stall) {
      candidates.push({
        id: `insight:stall:${pid}`,
        kind: 'insight', expression: 'idle',
        text: `${selectedPlant.name} hasn't gained much height in ${stall.days} days. Could be normal — or worth a peek at the roots. 🌱`,
        priority: TIP_KINDS.insight,
      });
    }
    const vigor = strongGrowth(logs);
    if (vigor) {
      candidates.push({
        id: `insight:vigor:${pid}`,
        kind: 'insight', expression: 'celebrating',
        text: `${selectedPlant.name} is shooting up (~${vigor.rate}cm/day)! Whatever you're doing, keep it up. 🚀`,
        priority: TIP_KINDS.insight,
      });
    }
    // Harvest countdown: once late flowering is logged, Bud gets giddy and counts
    // down; harvest day itself is a full-blown milestone.
    const hc = harvestCountdown(logs, selectedPlant.species, now);
    if (hc && hc.ready) {
      candidates.push({
        id: `milestone:harvestday:${pid}`,
        kind: 'milestone', expression: 'celebrating',
        text: `IT'S HARVEST TIME for ${selectedPlant.name}!! 🎉🌾 Months of care, all paid off. Enjoy the fruits (well... buds) of your labor!`,
        priority: TIP_KINDS.milestone,
      });
    } else if (hc && hc.days <= 14) {
      candidates.push({
        id: `insight:harvestcd:${pid}:${hc.days}`,
        kind: 'insight', expression: 'celebrating',
        text: `${selectedPlant.name} is about ${hc.days} days (${hc.low}-${hc.high}) from the harvest window. The countdown is ON. 🌾`,
        priority: TIP_KINDS.insight,
      });
    } else if (isHarvestWindow(stage)) {
      candidates.push({
        id: `insight:harvest:${pid}:${stage}`,
        kind: 'insight', expression: 'celebrating',
        text: `${selectedPlant.name} is in the home stretch — harvest is just around the corner. 🌾`,
        priority: TIP_KINDS.insight,
      });
    }
  }

  // 4. Contextual — one tip tuned to the current tab.
  const ctx = contextualTip({ activeTab, selectedPlant, stage, pid });
  if (ctx) candidates.push(ctx);

  // (Idle tips are added by selectTip, since they depend on the injected `now`.)
  return candidates;
}

function contextualTip({ activeTab, selectedPlant, stage, pid }) {
  const base = { kind: 'contextual', expression: 'happy', priority: TIP_KINDS.contextual };
  switch (activeTab) {
    case 'add-log':
      return { ...base, id: `contextual:add-log:${pid}`, text: "While you're here, jot down pH and EC too — future-you will be grateful. 📝" };
    case 'feeding': {
      const g = selectedPlant ? getStageGuidance(selectedPlant.species, stage) : null;
      const text = g && g.ec
        ? `For ${stageLabel(stage)}, aim for an EC around ${g.ec.min}–${g.ec.max}. Feed 'em right!`
        : "Consistent feeding beats heavy feeding. Little and often wins.";
      return { ...base, id: `contextual:feeding:${pid}:${stage || 'any'}`, text };
    }
    case 'view-logs':
      return { ...base, id: `contextual:view-logs:${pid}`, expression: 'idle', text: "Spot a funky reading? Click me and I'll help you make sense of it. 🔍" };
    case 'plants':
      return { ...base, id: `contextual:plants:${pid}`, text: "Give your grow a fun name — Bud believes in you. 🌿" };
    case 'settings':
      return { ...base, id: `contextual:settings:${pid}`, expression: 'idle', text: "Prefer °F or inches? Switch units here and the whole app follows along." };
    case 'dashboard':
    default:
      if (selectedPlant) {
        return { ...base, id: `contextual:dashboard:${pid}`, text: `${selectedPlant.name}${stage ? ` is cruising through ${stageLabel(stage)}` : ' is looking good'} — keep it up! 🌱` };
      }
      return { ...base, id: 'contextual:dashboard:none', expression: 'idle', text: GREETING_TIPS[0] };
  }
}

// ------------------------------- ask menu --------------------------------- //

// Answer a direct question the user picked from Bud's click menu. `key` is one of
// 'status' | 'action' | 'fun'. Returns a tip-shaped { id, text, expression,
// dismissible }. Unlike the proactive engine this is user-initiated, so it always
// returns something and ignores the rate-limit.
export function answerQuestion(input = {}, key = 'status', opts = {}) {
  const { now = 0 } = opts;
  const { selectedPlant, alerts = [], logs = [], stage, schedules = [] } = input;
  const base = { kind: 'answer', dismissible: true };

  if (key === 'fun') {
    const pool = [...IDLE_TIPS, ...GREETING_TIPS];
    const i = Math.floor(now / RATE_LIMIT_MS) % pool.length;
    return { ...base, id: 'answer:fun', expression: 'happy', text: pool[i] };
  }

  if (!selectedPlant) {
    return {
      ...base,
      id: 'answer:noplant',
      expression: 'idle',
      text: key === 'action'
        ? "Pick a plant from the sidebar and I'll tell you the next move. 🌱"
        : "Pick a plant and I'll give you the rundown. 🌿",
    };
  }

  if (key === 'week') {
    // A 7-day rundown: logging activity, height gain, pH spread, feedings done/due.
    const weekAgo = now - 7 * 86400000;
    const logTime = (l) => new Date(l.date ?? l.created_at).getTime();
    const weekLogs = logs.filter((l) => {
      const t = logTime(l);
      return t >= weekAgo && t <= now;
    });
    if (!weekLogs.length) {
      return {
        ...base,
        id: 'answer:week:quiet',
        expression: 'idle',
        text: `Pretty quiet week for ${selectedPlant.name} — no logs in the last 7 days. A fresh reading would make next week's report way juicier. 📋`,
      };
    }
    const parts = [`${weekLogs.length} log${weekLogs.length === 1 ? '' : 's'}`];
    const heights = weekLogs.map((l) => parseFloat(l.height)).filter((h) => !Number.isNaN(h));
    if (heights.length >= 2) {
      const gain = Math.round((Math.max(...heights) - Math.min(...heights)) * 10) / 10;
      if (gain > 0) parts.push(`~${gain}cm of growth`);
    }
    const phs = weekLogs.map((l) => parseFloat(l.ph)).filter((p) => !Number.isNaN(p));
    if (phs.length) {
      const lo = Math.min(...phs);
      const hi = Math.max(...phs);
      parts.push(hi - lo <= 0.3 ? `pH rock-steady around ${hi}` : `pH ranged ${lo}–${hi}`);
    }
    const fed = schedules.filter((s) => s && s.last_fed && (() => {
      const t = new Date(s.last_fed).getTime();
      return t >= weekAgo && t <= now;
    })()).length;
    if (fed) parts.push(`${fed} feeding${fed === 1 ? '' : 's'} done`);
    const dueNow = schedules.filter((s) => s && s.active !== false && feedingStatus(s, new Date(now)).due).length;
    const ps = dueNow ? ` P.S. ${dueNow === 1 ? 'a feed is' : `${dueNow} feeds are`} due — just sayin'. 🍽️` : '';
    return {
      ...base,
      id: 'answer:week',
      expression: 'happy',
      text: `${selectedPlant.name}'s week: ${parts.join(', ')}. Solid work. 🌿${ps}`,
    };
  }

  if (key === 'action') {
    // Ranked: fix an out-of-range reading › feed if due › log if stale › stage care.
    const bad = alerts.find((a) => a.status === 'out' && a.range) || alerts.find((a) => a.range);
    if (bad) {
      const copy = ALERT_COPY[bad.key];
      return { ...base, id: 'answer:action:alert', expression: 'alert', text: copy ? copy(bad) : `${bad.label} is out of range — worth a fix. 🌱` };
    }
    const due = schedules.find((s) => s && s.active !== false && feedingStatus(s, new Date(now)).due);
    if (due) {
      return { ...base, id: 'answer:action:feed', expression: 'happy', text: `Give ${selectedPlant.name} a feed — ${due.nutrient_type || 'nutrients'} are due. 🍽️` };
    }
    const latest = latestLog(logs);
    const daysSince = latest ? Math.floor((now - new Date(latest.date ?? latest.created_at).getTime()) / 86400000) : null;
    if (daysSince !== null && daysSince >= LOG_NUDGE_DAYS) {
      return { ...base, id: 'answer:action:log', expression: 'idle', text: `Pop in a fresh log — it's been ${daysSince} days since the last one. 📋` };
    }
    const g = getStageGuidance(selectedPlant.species, stage);
    return { ...base, id: 'answer:action:care', expression: 'happy', text: g && g.care ? `For ${stageLabel(stage)}: ${g.care}` : "You're on track — keep doing what you're doing. 🌿" };
  }

  // status — a quick rundown of the selected plant.
  const h = currentHeight(logs);
  const stageTxt = stage ? stageLabel(stage) : 'just getting started';
  const health = alerts.length
    ? `${alerts.length} reading${alerts.length === 1 ? '' : 's'} to keep an eye on 👀`
    : 'everything looks healthy 🌿';
  return {
    ...base,
    id: `answer:status:${plantKey(selectedPlant)}`,
    expression: alerts.length ? 'alert' : 'happy',
    text: `${selectedPlant.name}: ${stageTxt}${h ? `, ~${h}cm tall` : ''}. ${health}.`,
  };
}

// ------------------------------- selection -------------------------------- //

// Pick the single best tip to show right now, or null. `opts.now` is injected so
// rate-limiting is deterministic in tests.
export function selectTip(input = {}, opts = {}) {
  const { now = 0, dismissedIds = [], lastShownAt = 0, muted = false } = opts;
  if (muted) return null;

  const dismissed = new Set(dismissedIds);
  const candidates = buildCandidates(input, now);

  // Logging nudge — depends on `now`, so it's generated here. If it's been a while
  // since the selected plant's latest log, gently suggest one.
  const { selectedPlant, logs = [] } = input;
  if (selectedPlant && logs.length) {
    const latest = latestLog(logs);
    const t = latest ? new Date(latest.date ?? latest.created_at).getTime() : 0;
    const daysSince = t ? Math.floor((now - t) / 86400000) : 0;
    if (daysSince >= LOG_NUDGE_DAYS) {
      candidates.push({
        id: `reminder:log:${plantKey(selectedPlant)}`,
        kind: 'reminder',
        expression: 'idle',
        text: `Haven't heard about ${selectedPlant.name} in ${daysSince} days — quick log to keep the chart honest? 📋`,
        priority: TIP_KINDS.reminder,
      });
    }
  }

  // Idle tips are generated here (depend on `now`) so the engine stays pure.
  const idleIndex = Math.floor(now / RATE_LIMIT_MS) % IDLE_TIPS.length;
  candidates.push({
    id: `idle:${idleIndex}`,
    kind: 'idle',
    expression: 'idle',
    text: IDLE_TIPS[idleIndex],
    priority: TIP_KINDS.idle,
  });

  // Rotate the chill pop-up greeting so it's not word-for-word every time.
  const greeting = candidates.find((c) => c.id === 'contextual:dashboard:none');
  if (greeting) {
    const gi = Math.floor(now / RATE_LIMIT_MS) % GREETING_TIPS.length;
    greeting.text = GREETING_TIPS[gi];
  }

  const visible = candidates
    .filter((c) => !dismissed.has(c.id))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const top = visible[0];
  if (!top) return null;

  // Alerts bypass the cooldown; everything else waits out the rate limit.
  if (top.kind !== 'alert' && now - lastShownAt < RATE_LIMIT_MS) return null;

  return { dismissible: true, ...top };
}
