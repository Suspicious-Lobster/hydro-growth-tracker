import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { useAssistant } from '../../contexts/AssistantContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useDraggable } from '../../hooks/useDraggable';
import { useBudWander } from '../../hooks/useBudWander';
import { latestLog } from '../../utils/stats';
import { inferStage } from '../../data/recommendations';
import { measurementAlerts } from '../../utils/ranges';
import { dueCount } from '../../utils/feeding';
import { vpdKpa } from '../../utils/vpd';
import { parseLocalDate } from '../../utils/dates';
import { selectTip, answerQuestion } from '../../data/assistantTips';
import { answer as answerChat } from '../../data/budChat';
import { isHarvestWindow } from '../../utils/trends';
import { earnedBadges, newlyEarned } from '../../utils/achievements';
import { setSoundEnabled, pop } from '../../utils/sound';
import { TOUR_STEPS, stepCompleted } from '../../data/onboarding';
import { useBudEvent } from '../../hooks/useBudEvent';
import { emitSafe } from '../../utils/budBus';
import { BUD_EVENTS } from '../../data/budCues';
import BudLeaf from './BudLeaf';
import BudRenderer from './BudRenderer';
import SpeechBubble from './SpeechBubble';
import AskMenu from './AskMenu';
import BudWizard from './BudWizard';
import DeficiencyHelper from '../DeficiencyHelper';
import Achievements from '../Achievements';

const SIZE = 324;
const CHECK_INTERVAL_MS = 60 * 1000;
const AWAY_SECONDS_FOR_WELCOME_BACK = 600; // 10 minutes

// Maps a budBus event to a cue name (or null to ignore it). Kept as a plain
// table, not a switch, so the red proof (MR-62) is a single deleted entry.
// Each entry is a function of the event payload so status-dependent events
// (form:reading) can branch.
const EVENT_TO_CUE = {
  [BUD_EVENTS.FORM_READING]: (payload) => {
    if (payload?.status === 'ok') return 'nod';
    if (payload?.status === 'warn' || payload?.status === 'out') return 'wince';
    return null;
  },
  [BUD_EVENTS.FORM_FOCUS]: () => 'peek',
  [BUD_EVENTS.SAVE_OK]: () => 'cheer',
  [BUD_EVENTS.SAVE_ERROR]: () => 'facepalm',
  [BUD_EVENTS.DELETE]: () => 'sulk',
  [BUD_EVENTS.APP_RETURN]: (payload) => (
    (payload?.awaySeconds ?? 0) >= AWAY_SECONDS_FOR_WELCOME_BACK ? 'welcomeBack' : null
  ),
  [BUD_EVENTS.TAB]: (payload) => (payload?.tab === 'settings' ? 'yawn' : null),
};

// Which badges have already been celebrated, kept local to BudMascot (not
// AssistantContext, since it's driven by data/achievements rather than a UI
// preference). Mirrors AssistantContext's read/write-guarded-with-try/catch style.
const BADGES_SEEN_KEY = 'bud.badges';
const readSeenBadgeIds = () => {
  try {
    const raw = localStorage.getItem(BADGES_SEEN_KEY);
    return raw === null ? [] : JSON.parse(raw);
  } catch {
    return [];
  }
};
const writeSeenBadgeIds = (ids) => {
  try { localStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(ids)); } catch { /* storage full/unavailable */ }
};

// The floating leaf buddy. Gathers the current context, asks the pure tip engine
// what (if anything) to say, and renders the draggable mascot + speech bubble.
export default function BudMascot({ activeTab, selectedPlant, onNavigate }) {
  const { getPlantLogs, getPlantReservoirEvents, schedules, logs: allLogs, plants, loading } = useAppData();
  const {
    effectsEnabled, muted, soundEnabled, position, minimized,
    dismissedTipIds, lastShownAt, setPosition, setMinimized, markShown, dismissTip,
    tourStep, tourDone, startTour, setTourStep, endTour, voice, wanderEnabled,
  } = useAssistant();
  const reduced = useReducedMotion();
  const animate = effectsEnabled && !reduced;

  const tourActive = !tourDone && tourStep != null && tourStep < TOUR_STEPS.length;
  const tourStepData = tourActive ? TOUR_STEPS[tourStep] : null;

  const [tip, setTip] = useState(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const shownIdRef = useRef(null);
  const prevCountsRef = useRef(null);

  // A one-shot piece of body language for BudRenderer/BudThree to perform
  // (see data/budCues.js). `at` is a counter-bumped timestamp so two events
  // arriving within the same millisecond still produce a distinct stamp the
  // rig can key an animation restart on.
  const [cue, setCue] = useState(null);
  const cueCounterRef = useRef(0);
  const fireCue = useCallback((name, payload) => {
    if (!name) return;
    cueCounterRef.current += 1;
    setCue({ name, at: Date.now() + cueCounterRef.current, payload });
  }, []);

  // The single point where budBus events become cues. Cues never open the
  // speech bubble and never call markShown — they're a silent reaction, not
  // a tip, so they don't touch the 60s tip rate limit.
  useBudEvent('*', useCallback((payload, type) => {
    const toCue = EVENT_TO_CUE[type];
    if (!toCue) return;
    fireCue(toCue(payload), payload);
  }, [fireCue]));

  // Bud perks up when the tab regains focus after a long absence. Tracks the
  // hidden timestamp locally and emits through the bus (rather than calling
  // fireCue directly) so the same mapping table handles both this and any
  // other source of an app:return event.
  const hiddenAtRef = useRef(null);
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (hiddenAtRef.current == null) return;
      const awaySeconds = Math.floor((Date.now() - hiddenAtRef.current) / 1000);
      hiddenAtRef.current = null;
      emitSafe(BUD_EVENTS.APP_RETURN, { awaySeconds });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Derive the engine input from current data.
  const logs = selectedPlant ? getPlantLogs(selectedPlant) : [];
  const latest = latestLog(logs);
  const stage = latest
    ? inferStage(selectedPlant?.species, latest.height, latest.growth_stage)
    : selectedPlant?.target_stage;
  const alerts = latest && selectedPlant ? measurementAlerts(latest, selectedPlant.species, stage) : [];
  const plantSchedules = selectedPlant
    ? (schedules || []).filter((s) => s.plant_id === selectedPlant.id)
    : [];
  // Reservoir history for the selected plant (guarded: older test mocks of
  // useAppData may not provide getPlantReservoirEvents at all).
  const reservoirEvents = selectedPlant && getPlantReservoirEvents ? getPlantReservoirEvents(selectedPlant) : [];
  // Informational VPD reading for the latest log; the out-of-band ALERT itself
  // already reaches Bud via `alerts` (measurementAlerts includes a 'vpd' key).
  const vpd = latest ? vpdKpa(latest.air_temp, latest.humidity) : null;
  // Badges: which are earned right now, and which are newly earned since the
  // last time we celebrated one (persisted in localStorage so it's not repeated).
  const earnedIds = earnedBadges({ plants, logs: allLogs }, new Date());
  const seenBadgeIds = readSeenBadgeIds();
  const newBadges = newlyEarned(seenBadgeIds, earnedIds);
  const input = { activeTab, selectedPlant, alerts, logs, stage, schedules: plantSchedules, newBadges, reservoirEvents, vpd, voice };

  // Worried resting face when the selected plant has a clearly out-of-range reading;
  // visibly buzzing once it's in the harvest window with nothing wrong.
  const mood = alerts.some((a) => a.status === 'out')
    ? 'concerned'
    : isHarvestWindow(stage) ? 'excited' : 'neutral';
  // Sunglasses are EARNED: there's real data and every reading is in range.
  const shades = Boolean(selectedPlant && latest && alerts.length === 0);

  // Keep the sound module in sync with prefs (muting Bud also silences him).
  useEffect(() => { setSoundEnabled(soundEnabled && !muted); }, [soundEnabled, muted]);

  // Keep the latest values in a ref so the interval/effect always sees fresh data
  // without re-subscribing on every render.
  const stateRef = useRef();
  stateRef.current = { input, dismissedIds: dismissedTipIds, lastShownAt, muted, earnedIds };

  // Age (whole days) of the most recent reservoir change, or null if none has
  // ever been logged — included in `sig` so crossing the stale-day threshold
  // re-triggers the proactive check.
  const newestChangeEvent = reservoirEvents.find((e) => e && e.kind === 'change');
  const reservoirAgeDays = newestChangeEvent
    ? (() => {
      const changedAt = parseLocalDate(newestChangeEvent.date);
      return changedAt ? Math.floor((Date.now() - changedAt.getTime()) / 86400000) : null;
    })()
    : null;

  // A compact signature: re-run the proactive check whenever the situation changes.
  const sig = JSON.stringify({
    activeTab,
    pid: selectedPlant?.id ?? null,
    n: logs.length,
    stage: stage ?? null,
    alerts: alerts.map((a) => `${a.key}:${a.status}`),
    feeds: dueCount(plantSchedules),
    day: Math.floor(Date.now() / 86400000), // re-evaluate time-based nudges daily
    muted,
    dismissed: dismissedTipIds.length,
    newBadges,
    reservoirAgeDays,
  });

  // MR-65: `wanderFollowRef` breaks the circular dependency between
  // useDraggable (needs `dragging` before `blocked` can be computed) and
  // useBudWander (needs `blocked` before it can produce the position
  // useDraggable should follow): each render passes useDraggable the wander
  // position *from the previous render* as `follow`. At animation frame
  // rates the one-render lag is imperceptible, and useDraggable ignores
  // `follow` entirely while an actual drag is in progress either way.
  const wanderFollowRef = useRef(null);
  const { position: pos, handleProps, dragging, wasDragged } = useDraggable(position, {
    size: { w: SIZE, h: SIZE },
    onCommit: setPosition,
    follow: wanderFollowRef.current,
  });

  // Never wander while the user is holding him, he's minimized, a bubble
  // (tip or ask-menu) is open, the tour is running, or the user turned
  // wandering off in Settings.
  const wanderBlocked = dragging || minimized || open || tourActive || !wanderEnabled;
  const wander = useBudWander({
    home: position,
    size: { w: SIZE, h: SIZE },
    blocked: wanderBlocked,
    onCue: fireCue,
  });
  wanderFollowRef.current = wanderBlocked ? null : wander.position;

  // Bud walks near the field the user just focused (MR-65). The '*' bus
  // subscription above already fires the 'peek' cue for this same event —
  // this is a second, dedicated subscription that also moves him.
  useBudEvent(BUD_EVENTS.FORM_FOCUS, useCallback(() => {
    const el = document.activeElement;
    if (el && el !== document.body) wander.goTo(el.getBoundingClientRect());
  }, [wander]));

  // Walks over and points at the out-of-range alerts once per plant, the
  // first time its view opens with something actually wrong — not on every
  // re-render, and not again for the same plant.
  const pointedPlantIdRef = useRef(null);
  useEffect(() => {
    const id = selectedPlant?.id ?? null;
    if (id == null || pointedPlantIdRef.current === id) return;
    pointedPlantIdRef.current = id;
    if (alerts.length === 0) return;
    const el = document.querySelector('[data-bud-anchor="alert"]');
    if (el) wander.goTo(el.getBoundingClientRect(), { point: true });
  }, [selectedPlant?.id, alerts.length, wander]);

  // A soft pop whenever the speech bubble appears (no-op unless sound is enabled).
  useEffect(() => { if (open) pop(); }, [open]);

  // Decide on first load whether a brand-new user gets the tour, or skip it for
  // anyone who already has plants.
  useEffect(() => {
    if (loading || tourDone || tourStep != null) return;
    if (plants.length === 0) startTour(); else endTour();
  }, [loading, tourDone, tourStep, plants.length, startTour, endTour]);

  useEffect(() => {
    if (muted || tourActive) return undefined; // the tour takes over while it runs
    const check = () => {
      const s = stateRef.current;
      const now = Date.now();
      const t = selectTip(s.input, { now, dismissedIds: s.dismissedIds, lastShownAt: s.lastShownAt, muted: s.muted });
      if (t && t.id !== shownIdRef.current) {
        shownIdRef.current = t.id;
        setTip(t);
        setOpen(true);
        setMenuOpen(false);
        markShown(now);
        // A badge milestone was actually shown — remember it so it's never
        // celebrated twice. Persist the ids as of this snapshot.
        if (t.id.startsWith('milestone:badge:')) writeSeenBadgeIds(s.earnedIds);
      }
    };
    check();
    const iv = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(iv);
  }, [sig, muted, tourActive, markShown]);

  // Watch the collections grow. During the tour this advances the active step when its
  // action is done; otherwise it celebrates a new log or plant. Baseline is captured
  // once data has loaded so the initial fetch (0 -> N) doesn't trigger either.
  const scheduleCount = (schedules || []).length;
  useEffect(() => {
    if (loading) return;
    const counts = { logs: allLogs.length, plants: plants.length, schedules: scheduleCount };
    const prev = prevCountsRef.current;
    if (prev) {
      if (tourActive) {
        if (tourStepData && stepCompleted(tourStepData, prev, counts)) setTourStep(tourStep + 1);
      } else if (!muted && (counts.logs > prev.logs || counts.plants > prev.plants)) {
        const text = counts.plants > prev.plants
          ? 'New green friend! Welcome to the family. 🌱🎉'
          : 'Nice — logged it! Every entry sharpens the picture. 🎉';
        shownIdRef.current = 'action:celebrate';
        setTip({ id: 'action:celebrate', kind: 'milestone', expression: 'celebrating', text, dismissible: true });
        setOpen(true);
        markShown(Date.now());
      }
    }
    prevCountsRef.current = counts;
  }, [loading, allLogs.length, plants.length, scheduleCount, muted, markShown,
    tourActive, tourStepData, tourStep, setTourStep]);

  // Click the leaf to open the ask-menu (or dismiss whatever's showing).
  const onLeafClick = useCallback(() => {
    if (wasDragged()) return;
    if (tourActive) return;                      // the tour owns the bubble right now
    if (open) { setOpen(false); return; }        // close an open tip
    if (menuOpen) { setMenuOpen(false); return; }
    setMenuOpen(true);
  }, [open, menuOpen, tourActive, wasDragged]);

  // Answer the picked question in the speech bubble (bypasses cooldown + mute).
  const onPick = useCallback((key) => {
    setMenuOpen(false);
    if (key === 'diagnose') { setDiagnoseOpen(true); return; }
    if (key === 'badges') { setBadgesOpen(true); return; }
    const answer = answerQuestion(stateRef.current.input, key, { now: Date.now() });
    shownIdRef.current = answer.id;
    setTip(answer);
    setOpen(true);
  }, []);
  // Free-text question typed into the AskMenu (MR-66). Answers are
  // user-initiated, like onPick's fixed questions, so they skip markShown
  // (exempt from the 60s rate limit) and also fire the returned body cue.
  const onAsk = useCallback((text) => {
    setMenuOpen(false);
    const res = answerChat(text, stateRef.current.input, { voice: stateRef.current.input.voice, now: Date.now() });
    const id = `chat:${Date.now()}`;
    shownIdRef.current = id;
    setTip({ id, kind: 'answer', expression: res.expression, text: res.text, dismissible: false });
    setOpen(true);
    fireCue(res.cue);
  }, [fireCue]);
  const closeDiagnose = useCallback(() => setDiagnoseOpen(false), []);
  const closeBadges = useCallback(() => setBadgesOpen(false), []);

  const closeTip = useCallback(() => setOpen(false), []);
  const dontShow = useCallback(() => {
    if (tip) dismissTip(tip.id);
    setOpen(false);
  }, [tip, dismissTip]);

  // Tour controls.
  const onTourPrimary = useCallback(() => {
    if (!tourStepData) return;
    if (tourStepData.primary === 'goto') { onNavigate?.(tourStepData.tab); return; }
    if (tourStepData.primary === 'finish') { endTour(); return; }
    setTourStep(tourStep + 1); // 'next'
  }, [tourStepData, tourStep, onNavigate, setTourStep, endTour]);
  const onTourSecondary = useCallback(() => setTourStep(tourStep + 1), [tourStep, setTourStep]);
  const onSkipTour = useCallback(() => endTour(), [endTour]);

  const expression = tourActive
    ? tourStepData.expression
    : (open && tip ? tip.expression : 'idle');

  if (minimized) {
    return (
      <div className="fixed z-50 pointer-events-none" style={{ right: pos.right, bottom: pos.bottom }}>
        <button
          onClick={() => setMinimized(false)}
          aria-label="Show Bud"
          className="pointer-events-auto rounded-full shadow-lg bg-green-600 hover:bg-green-500 p-1.5 transition-colors"
        >
          <BudLeaf expression="idle" animate={false} size={44} />
        </button>
      </div>
    );
  }

  return (
    <>
      {diagnoseOpen && <DeficiencyHelper onClose={closeDiagnose} />}
      {badgesOpen && <Achievements earnedIds={earnedIds} onClose={closeBadges} />}
      <div
        className="fixed z-50 flex flex-col items-end pointer-events-none"
        style={{ right: pos.right, bottom: pos.bottom }}
      >
        {tourActive ? (
          <div className="pointer-events-auto">
            <BudWizard
              step={tourStepData}
              index={tourStep}
              total={TOUR_STEPS.length}
              animate={animate}
              onPrimary={onTourPrimary}
              onSecondary={onTourSecondary}
              onSkip={onSkipTour}
            />
          </div>
        ) : (
          <>
            {open && (
              <div className="pointer-events-auto">
                <SpeechBubble tip={tip} animate={animate} onClose={closeTip} onDontShow={dontShow} />
              </div>
            )}

            {menuOpen && !open && (
              <div className="pointer-events-auto">
                <AskMenu animate={animate} onPick={onPick} onAsk={onAsk} />
              </div>
            )}
          </>
        )}

        <div className="relative pointer-events-auto">
          <button
            {...handleProps}
            onClick={onLeafClick}
            aria-label="Bud the assistant — click to ask, drag to move"
            className="block cursor-grab active:cursor-grabbing touch-none select-none drop-shadow-lg"
            style={{ touchAction: 'none' }}
          >
            <BudRenderer expression={expression} animate={animate} size={SIZE} dragging={dragging} talking={open || tourActive} mood={mood} shades={shades} cue={cue} />
          </button>
          <button
            onClick={() => setMinimized(true)}
            aria-label="Minimize Bud"
            className="absolute -top-1 -left-1 bg-black/40 hover:bg-black/60 text-white rounded-full p-0.5 transition-colors"
          >
            <Minus size={12} />
          </button>
        </div>
      </div>
    </>
  );
}
