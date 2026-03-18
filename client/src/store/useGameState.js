// client/src/store/useGameState.js
import { useRef, useSyncExternalStore } from "react";
import { getState, subscribe } from "./gameStore.js";

function shallowClone(v) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.slice();
  if (typeof v === "object") return { ...v };
  return v;
}

/**
 * ✅ React rule:
 * getSnapshot must return the same reference if nothing changed.
 * We keep a per-hook cache in useRef so it persists across renders.
 */
export function useGameState(selector = (s) => s) {
  const cacheRef = useRef({
    lastRaw: undefined,
    lastSnap: undefined,
  });

  const getSnapshot = () => {
    const raw = selector(getState());

    // stable when selector output is stable
    if (Object.is(raw, cacheRef.current.lastRaw)) {
      return cacheRef.current.lastSnap;
    }

    cacheRef.current.lastRaw = raw;
    cacheRef.current.lastSnap = shallowClone(raw);
    return cacheRef.current.lastSnap;
  };

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}