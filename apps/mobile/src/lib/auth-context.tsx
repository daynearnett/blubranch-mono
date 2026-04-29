import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse } from '@blubranch/shared';
import * as api from './api.js';
import { secureStorage } from './storage.js';

const ACCESS_KEY = 'bb.access';
const REFRESH_KEY = 'bb.refresh';
const USER_KEY = 'bb.user';

type AuthUser = AuthResponse['user'];

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'signed-in' | 'signed-out';
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: import('@blubranch/shared').RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');

  const persist = useCallback(async (res: AuthResponse) => {
    api.setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus('signed-in');
    await Promise.all([
      secureStorage.setItem(ACCESS_KEY, res.accessToken),
      secureStorage.setItem(REFRESH_KEY, res.refreshToken),
      secureStorage.setItem(USER_KEY, JSON.stringify(res.user)),
    ]);
  }, []);

  // Bootstrap from storage on mount.
  // Wrapped end-to-end in try/catch so a Keychain failure, corrupt blob, or
  // unreachable refresh endpoint can never block the app from rendering the
  // signed-out UI. The Welcome screen must come up no matter what.
  useEffect(() => {
    (async () => {
      try {
        const [access, refresh, userJson] = await Promise.all([
          secureStorage.getItem(ACCESS_KEY).catch(() => null),
          secureStorage.getItem(REFRESH_KEY).catch(() => null),
          secureStorage.getItem(USER_KEY).catch(() => null),
        ]);
        if (access && userJson) {
          api.setAccessToken(access);
          try {
            setUser(JSON.parse(userJson));
            setStatus('signed-in');
            // Best-effort token refresh in the background. If the API host
            // doesn't resolve (e.g. staging not yet deployed) this rejects
            // silently — the user keeps their cached session.
            if (refresh) {
              api.auth
                .refresh(refresh)
                .then(persist)
                .catch(() => {
                  /* keep current session on refresh failure */
                });
            }
            return;
          } catch {
            // Stored user JSON is corrupt — fall through to signed-out.
          }
        }
      } catch (err) {
        // Should be unreachable since per-call catches above swallow errors,
        // but if anything else throws (e.g. a future native module), we still
        // bail to signed-out instead of leaving the UI stuck on 'loading'.
        console.warn('[auth] bootstrap failed', err);
      }
      setStatus('signed-out');
    })();
  }, [persist]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.auth.login({ email, password });
      await persist(res);
    },
    [persist],
  );

  const register = useCallback(
    async (input: import('@blubranch/shared').RegisterInput) => {
      const res = await api.auth.register(input);
      await persist(res);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    api.setAccessToken(null);
    setUser(null);
    setStatus('signed-out');
    await Promise.all([
      secureStorage.deleteItem(ACCESS_KEY),
      secureStorage.deleteItem(REFRESH_KEY),
      secureStorage.deleteItem(USER_KEY),
    ]);
  }, []);

  const refresh = useCallback(async () => {
    const refreshToken = await secureStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return;
    const res = await api.auth.refresh(refreshToken);
    await persist(res);
  }, [persist]);

  const value = useMemo<AuthState>(
    () => ({ user, status, signIn, register, signOut, refresh, setUser }),
    [user, status, signIn, register, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
