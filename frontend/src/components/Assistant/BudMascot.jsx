import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Minus } from 'lucide-react';
import { useAppData } from '../../contexts/AppDataContext';
import { useAssistant } from '../../contexts/AssistantContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useDraggable } from '../../hooks/useDraggable';
import { latestLog } from '../../utils/stats';
import { inferStage } from '../../data/recommendations';
import { measurementAlerts } from '../../utils/ranges';
import { dueCount } from '../../utils/feeding';
import { selectTip, answerQuestion } from '../../data/assistantTips';
import { isHarvestWindow } from '../../utils/trends';
import { setSoundEnabled, pop } from '../../utils/sound';
import { TOUR_STEPS, stepCompleted } from '../../data/onboarding';
import BudLeaf from './BudLeaf';
import BudRenderer from './BudRenderer';
import SpeechBubble from './SpeechBubble';
import AskMenu from './AskMenu';
import BudWizard from './BudWizard';
import DeficiencyHelper from '../DeficiencyHelper';

const SIZE = 324;
const CHECK_INTERVAL_MS = 60 * 1000;

// The floating leaf buddy. Gathers the current context, asks the pure tip engine
// what (if anything) to say, and renders the draggable mascot + speech bubble.
export default function BudMascot({ activeTab, selectedPlant, onNavigate }) {
  const { getPlantLogs, schedules, logs: allLogs, plants, loading } = useAppData();
  const {
    effectsEnabled, muted, soundEnabled, position, minimized,
    dismissedTipIds, lastShownAt, setPosition, setMinimized, markShown, dismissTip,
    tourStep, tourDone, startTour, setTourStep, endTour,
  } = useAssistant();
  const reduced = useReducedMotion();
  const animate = effectsEnabled && !reduced;

  const tourActive = !tourDone && tourStep != null && tourStep < TOUR_STEPS.length;
  const tourStepData = tourActive ? TOUR_STEPS[tourStep] : null;

  const [tip, setTip] = useState(null);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [diagnoseOpen, setDiagnoseOpen] = useState(false);
  const shownIdRef = useRef(null);
  const prevCountsRef = useRef(null);

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
  const input = { activeTab, selectedPlant, alerts, logs, stage, schedules: plantSchedules };

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
  stateRef.current = { input, dismissedIds: dismissedTipIds, lastShownAt, muted };

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
  });

  const { position: pos, handleProps, dragging, wasDragged } = useDraggable(position, {
    size: { w: SIZE, h: SIZE },
    onCommit: setPosition,
  });

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
    const answer = answerQuestion(stateRef.current.input, key, { now: Date.now() });
    shownIdRef.current = answer.id;
    setTip(answer);
    setOpen(true);
  }, []);
  const closeDiagnose = useCallback(() => setDiagnoseOpen(false), []);

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
                <AskMenu animate={animate} onPick={onPick} />
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
            <BudRenderer expression={expression} animate={animate} size={SIZE} dragging={dragging} talking={open || tourActive} mood={mood} shades={shades} />
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
