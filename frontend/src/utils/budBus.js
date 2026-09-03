// MR-62: the app-wide event bus that lets the rest of the app tell Bud what
// the user is doing, without Bud's brain (BudMascot) needing to be threaded
// through every form and delete button. A form calls `emit`/`emitSafe` with
// one of the named events in data/budCues.js; BudMascot subscribes with '*'
// and maps events to cues (see BudMascot.jsx). Kept dependency-free and pure
// (no React) so it can be imported from anywhere, including tests, without a
// provider.

import { BUD_EVENT_NAMES } from '../data/budCues';

// type -> Set<listener>. A dedicated '*' entry receives every event.
let listeners = new Map();

function setFor(type) {
  let set = listeners.get(type);
  if (!set) {
    set = new Set();
    listeners.set(type, set);
  }
  return set;
}

// Subscribe to one event type, or '*' for all of them. Returns an
// unsubscribe function. `fn` is called as `fn(payload, type)`.
export function subscribe(type, fn) {
  const set = setFor(type);
  set.add(fn);
  return () => set.delete(fn);
}

// Emit a named event to its listeners and to every '*' listener. Throws if
// `type` isn't one of BUD_EVENT_NAMES (data/budCues.js) — a typo in an event
// name should fail loudly in dev/tests rather than silently doing nothing.
// A listener that throws is caught and logged so one bad subscriber can
// never break the caller (e.g. a form's save handler).
export function emit(type, payload) {
  if (!BUD_EVENT_NAMES.includes(type)) {
    throw new Error(`budBus: unknown event "${type}"`);
  }
  const targets = [...setFor(type), ...setFor('*')];
  for (const fn of targets) {
    try {
      fn(payload, type);
    } catch (err) {
      console.error(`budBus: listener for "${type}" threw`, err);
    }
  }
}

// Same as `emit`, but swallows the "unknown event" error instead of
// throwing. Forms should use this so a typo'd event name can't crash a save.
export function emitSafe(type, payload) {
  try {
    emit(type, payload);
  } catch (err) {
    console.error(err.message);
  }
}

// Test-only: clear all listeners between tests so one test's subscriptions
// can't leak into the next.
export function _reset() {
  listeners = new Map();
}
