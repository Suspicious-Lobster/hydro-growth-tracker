import { useEffect, useRef } from 'react';
import { subscribe } from '../utils/budBus';

// Subscribe to a budBus event for the lifetime of the calling component.
// `handler` is read via a ref so callers can pass an inline arrow function
// on every render without re-subscribing (mirrors the stateRef pattern
// already used in BudMascot for the tip-check interval).
export function useBudEvent(type, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = subscribe(type, (payload, eventType) => {
      handlerRef.current?.(payload, eventType);
    });
    return unsubscribe;
  }, [type]);
}
