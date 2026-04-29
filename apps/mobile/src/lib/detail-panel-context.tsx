// Drives the desktop right-pane on screens that have a "detail of X" concept
// (job board → job detail, applicant dashboard → worker profile).
//
// Pages tap an item and write `{ kind, id }` here. The desktop layout reads it
// and renders the matching detail in the third column. On mobile/tablet,
// nothing reads it — pages navigate to a dedicated screen instead.

import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type DetailTarget =
  | { kind: 'job'; id: string }
  | { kind: 'user'; id: string }
  | null;

interface DetailPanelValue {
  target: DetailTarget;
  setTarget: (t: DetailTarget) => void;
}

const Ctx = createContext<DetailPanelValue | null>(null);

export function DetailPanelProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DetailTarget>(null);
  const value = useMemo<DetailPanelValue>(() => ({ target, setTarget }), [target]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDetailPanel(): DetailPanelValue {
  const ctx = useContext(Ctx);
  // Optional context — components outside the provider just no-op.
  return ctx ?? { target: null, setTarget: () => undefined };
}
