// Shared Quick Apply gate state for the three screens that can start an
// apply (Home feed, Job board, Job detail). Each of them owns a
// QuickApplyModal and a ProfileGateSheet; this hook decides which one opens.
//
// The pre-check is what the worker normally hits: tap Quick Apply, and if
// the profile isn't ready we show the gate instead of an apply sheet that
// was always going to fail. `handleBlocked` is the backstop for the 403,
// which still fires if readiness changed in between.

import { useCallback, useState } from 'react';
import { me, readinessFromError, type MissingRequirement } from '../lib/api.js';

export interface ApplyGate<T> {
  /** Job currently in the apply sheet, or null. */
  target: T | null;
  /** Missing requirements to render in the gate sheet; empty when hidden. */
  missing: MissingRequirement[];
  /** Call on Quick Apply press. Opens the gate or the apply sheet. */
  open: (target: T) => Promise<void>;
  /** Pass to QuickApplyModal's onBlocked. */
  handleBlocked: (missing: MissingRequirement[]) => void;
  closeApply: () => void;
  closeGate: () => void;
}

export function useApplyGate<T>(): ApplyGate<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [missing, setMissing] = useState<MissingRequirement[]>([]);

  const open = useCallback(async (next: T) => {
    try {
      const readiness = await me.applyReadiness();
      if (!readiness.ready) {
        setMissing(readiness.missing);
        return;
      }
    } catch {
      // Readiness is an optimization, not the enforcement point. If the
      // check fails (offline, older server with no such route), fall
      // through to the apply sheet — the server still gates the POST.
    }
    setTarget(next);
  }, []);

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
