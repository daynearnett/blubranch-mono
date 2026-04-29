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
  useEffect(() => {
    (async () => {
      const [access, refresh, userJson] = await Promise.all([
        secureStorage.getItem(ACCESS_KEY),
        secureStorage.getItem(REFRESH_KEY),
        secureStorage.getItem(USER_KEY),
      ]);
      if (access && userJson) {
        api.setAccessToken(access);
        try {
          setUser(JSON.parse(userJson));
          setStatus('signed-in');
          // Best-effort token refresh in the background.
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
          // fall through to signed-out
        }
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
