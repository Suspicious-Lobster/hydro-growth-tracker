import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';

// Local UI preferences + runtime state for Bud the assistant. Stored in
// localStorage (NOT the server settings) and shared app-wide. Mirrors the
// ThemeContext pattern: lazy init from storage, persist on change.

const AssistantContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAssistant = () => {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant must be used within an AssistantProvider');
  return ctx;
};

const KEYS = {
  effects: 'bud.effectsEnabled',
  muted: 'bud.muted',
  sound: 'bud.soundEnabled',
  position: 'bud.position',
  minimized: 'bud.minimized',
  dismissed: 'bud.dismissedTipIds',
  lastShown: 'bud.lastShownAt',
  tourStep: 'bud.tourStep',
  tourDone: 'bud.tourDone',
  remindersEnabled: 'bud.remindersEnabled',
};

const DEFAULT_POSITION = { right: 24, bottom: 24 };

// Read + JSON-parse a key, falling back to a default on missing/corrupt data.
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/unavailable */ }
};

export const AssistantProvider = ({ children }) => {
  const [effectsEnabled, setEffectsEnabled] = useState(() => read(KEYS.effects, true));
  const [muted, setMutedState] = useState(() => read(KEYS.muted, false));
  // Tiny synthesized sound effects (bubble pop, snore, lighter flick). Opt-in.
  const [soundEnabled, setSoundEnabledState] = useState(() => read(KEYS.sound, false));
  const [position, setPositionState] = useState(() => read(KEYS.position, DEFAULT_POSITION));
  const [minimized, setMinimizedState] = useState(() => read(KEYS.minimized, false));
  const [dismissedTipIds, setDismissedTipIds] = useState(() => read(KEYS.dismissed, []));
  const [lastShownAt, setLastShownAtState] = useState(() => read(KEYS.lastShown, 0));
  // tourStep: null = undecided (BudMascot will start or skip on first load), a number
  // = the active step index. tourDone: the tour has been finished/skipped.
  const [tourStep, setTourStepState] = useState(() => read(KEYS.tourStep, null));
  const [tourDone, setTourDone] = useState(() => read(KEYS.tourDone, false));
  // Desktop notification when a feeding is due (MR-44). Default on.
  const [remindersEnabled, setRemindersEnabledState] = useState(() => read(KEYS.remindersEnabled, true));

  useEffect(() => write(KEYS.effects, effectsEnabled), [effectsEnabled]);
  useEffect(() => write(KEYS.muted, muted), [muted]);
  useEffect(() => write(KEYS.sound, soundEnabled), [soundEnabled]);
  useEffect(() => write(KEYS.position, position), [position]);
  useEffect(() => write(KEYS.minimized, minimized), [minimized]);
  useEffect(() => write(KEYS.dismissed, dismissedTipIds), [dismissedTipIds]);
  useEffect(() => write(KEYS.lastShown, lastShownAt), [lastShownAt]);
  useEffect(() => write(KEYS.tourStep, tourStep), [tourStep]);
  useEffect(() => write(KEYS.tourDone, tourDone), [tourDone]);
  useEffect(() => write(KEYS.remindersEnabled, remindersEnabled), [remindersEnabled]);

  const toggleEffects = useCallback(() => setEffectsEnabled((v) => !v), []);
  const setMuted = useCallback((v) => setMutedState(Boolean(v)), []);
  const setSoundEnabled = useCallback((v) => setSoundEnabledState(Boolean(v)), []);
  const setPosition = useCallback((p) => setPositionState(p), []);
  const setMinimized = useCallback((v) => setMinimizedState(Boolean(v)), []);
  const setRemindersEnabled = useCallback((v) => setRemindersEnabledState(Boolean(v)), []);
  const markShown = useCallback((now) => setLastShownAtState(now), []);
  const dismissTip = useCallback((id) => {
    setDismissedTipIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
  }, []);
  const resetDismissed = useCallback(() => setDismissedTipIds([]), []);

  const startTour = useCallback(() => { setTourDone(false); setTourStepState(0); }, []);
  const setTourStep = useCallback((n) => setTourStepState(n), []);
  const endTour = useCallback(() => { setTourDone(true); setTourStepState(null); }, []);

  const value = useMemo(() => ({
    effectsEnabled, muted, soundEnabled, position, minimized, dismissedTipIds, lastShownAt,
    tourStep, tourDone, remindersEnabled,
    toggleEffects, setMuted, setSoundEnabled, setPosition, setMinimized, markShown, dismissTip, resetDismissed,
    startTour, setTourStep, endTour, setRemindersEnabled,
  }), [effectsEnabled, muted, soundEnabled, position, minimized, dismissedTipIds, lastShownAt,
    tourStep, tourDone, remindersEnabled,
    toggleEffects, setMuted, setSoundEnabled, setPosition, setMinimized, markShown, dismissTip, resetDismissed,
    startTour, setTourStep, endTour, setRemindersEnabled]);

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
};
