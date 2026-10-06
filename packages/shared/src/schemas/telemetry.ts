import { z } from 'zod';

// ── App usage telemetry ──────────────────────────────────────────
// One foreground stretch in the mobile app. The client sends the two
// timestamps and the server derives the duration, so a wrong clock or a
// tampered client can't inflate someone's usage. Foreground time in
// BluBranch only: device-level screen time is not readable by an app on
// either platform, and we do not ask for it.
export const appSessionInputSchema = z.object({
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  platform: z.string().max(20).optional(),
  appVersion: z.string().max(50).optional(),
});
export type AppSessionInput = z.infer<typeof appSessionInputSchema>;
