// Shared Quick Apply gate state for the three screens that can start an
// apply (Home feed, Job board, Job detail). Each of them owns a
// QuickApplyModal and a ProfileGateSheet; this hook decides which one opens.
//
// Readiness is fetched once when the screen mounts and refreshed on focus,
// NOT on the button press — a round-trip between tapping Quick Apply and
// anything appearing reads as a dead tap. The cached answer makes the tap
// instant; `handleBlocked` catches the case where it went stale (or where
// the fetch failed and we let the press through optimistically).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { me, readinessFromError, type ApplyReadiness, type MissingRequirement } from '../lib/api.js';

export interface ApplyGate<T> {
  /** Job currently in the apply sheet, or null. */
  target: T | null;
  /** Missing requirements to render in the gate sheet; empty when hidden. */
  missing: MissingRequirement[];
  /** Call on Quick Apply press. Opens the gate or the apply sheet. */
  open: (target: T) => void;
  /** Pass to QuickApplyModal's onBlocked. */
  handleBlocked: (missing: MissingRequirement[]) => void;
  closeApply: () => void;
  closeGate: () => void;
}

export function useApplyGate<T>(): ApplyGate<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [missing, setMissing] = useState<MissingRequirement[]>([]);
  const [readiness, setReadiness] = useState<ApplyReadiness | null>(null);

  // Refresh on focus so finishing the profile and coming back doesn't leave
  // a stale "not ready" cached.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      me.applyReadiness()
        .then((next) => active && setReadiness(next))
        // Readiness is an optimization, not the enforcement point. On a
        // failure (offline, older server with no such route) we leave it
        // null and let the press through — the server still gates the POST.
        .catch(() => active && setReadiness(null));
      return () => {
        active = false;
      };
    }, []),
  );

  const open = useCallback(
    (next: T) => {
      if (readiness && !readiness.ready) {
        setMissing(readiness.missing);
        return;
      }
      setTarget(next);
    },
    [readiness],
  );

  const handleBlocked = useCallback((next: MissingRequirement[]) => {
    setTarget(null);
    setMissing(next);
  }, []);

  return {
    target,
    missing,
    open,
    handleBlocked,
    closeApply: useCallback(() => setTarget(null), []),
    closeGate: useCallback(() => setMissing([]), []),
  };
}

/** Re-exported so call sites don't need a second import for the 403 path. */
export { readinessFromError };
