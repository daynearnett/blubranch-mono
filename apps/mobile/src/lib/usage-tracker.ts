import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import type { AppSessionInput } from '@blubranch/shared';
import { appSessions } from './api.js';
import { useAuth } from './auth-context.js';

// Measures how long the app sits in the foreground, per signed-in user, and
// ships one row per stretch to POST /app-sessions. The admin panel rolls
// these up under "App usage".
//
// What this is NOT: phone screen time. iOS only exposes that through the
// Screen Time API (entitlement-gated, and the data is sandboxed on-device by
// design), and Android's UsageStatsManager needs a special permission Play
// restricts. Neither is usable here, so we measure our own app and say so.

const QUEUE_KEY = 'bb_pending_app_sessions';
// A stretch shorter than this is a mis-tap or an app-switcher glance.
const MIN_SESSION_MS = 3_000;
// Cap the backlog so a long offline stretch can't grow unbounded; oldest go first.
const MAX_QUEUED = 50;

async function readQueue(): Promise<AppSessionInput[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as AppSessionInput[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(sessions: AppSessionInput[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(sessions.slice(-MAX_QUEUED)));
  } catch {
    // Storage full or unavailable — telemetry is never worth failing over.
  }
}

// Send everything we have, keeping whatever still won't go through. Stops at
// the first failure so an offline device doesn't burn through the whole queue.
async function flush(): Promise<void> {
  const queued = await readQueue();
  if (queued.length === 0) return;
  const remaining = [...queued];
  while (remaining.length > 0) {
    try {
      await appSessions.record(remaining[0]!);
      remaining.shift();
    } catch {
      break;
    }
  }
  if (remaining.length !== queued.length) await writeQueue(remaining);
}

async function enqueue(session: AppSessionInput): Promise<void> {
  await writeQueue([...(await readQueue()), session]);
  await flush();
}

/**
 * Tracks foreground time for the signed-in user. Mount once, high in the tree
 * and inside AuthProvider.
 */
export function useUsageTracking(): void {
  const { status } = useAuth();
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'signed-in') {
      openedAt.current = null;
      return;
    }

    const appVersion = Constants.expoConfig?.version ?? undefined;
    openedAt.current = Date.now();
    void flush();

    const closeSession = (): void => {
      const started = openedAt.current;
      openedAt.current = null;
      if (started === null) return;
      const endedAtMs = Date.now();
      if (endedAtMs - started < MIN_SESSION_MS) return;
      void enqueue({
        startedAt: new Date(started).toISOString(),
        endedAt: new Date(endedAtMs).toISOString(),
        platform: Platform.OS,
        appVersion,
      });
    };

    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        if (openedAt.current === null) openedAt.current = Date.now();
        void flush();
      } else {
        // 'background' on both platforms, plus iOS 'inactive' (app switcher,
        // incoming call). Treating inactive as a close can clip a stretch by a
        // second or two; undercounting beats inventing time.
        closeSession();
      }
    });

    return () => {
      closeSession();
      subscription.remove();
    };
  }, [status]);
}
