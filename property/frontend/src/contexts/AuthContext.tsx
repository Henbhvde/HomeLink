import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '../types/auth';
import { logoutApi, refreshSessionApi, setAccessToken, type AuthSession } from '../services/authApi';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    window.localStorage.removeItem('homelink-auth-session');
    refreshSessionApi()
      .then((refreshed) => { setAccessToken(refreshed.token); setSession(refreshed); })
      .catch(() => { setAccessToken(null); setSession(null); })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!session?.token) return undefined;
    try {
      const segment = session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '='))) as { exp?: number };
      const delay = Math.max(0, (payload.exp ?? 0) * 1000 - Date.now() - 60_000);
      const timer = window.setTimeout(async () => {
        try {
          const refreshed = await refreshSessionApi();
          setAccessToken(refreshed.token);
          setSession(refreshed);
        } catch {
          setAccessToken(null);
          setSession(null);
        }
      }, delay);
      return () => window.clearTimeout(timer);
    } catch { return undefined; }
  }, [session?.token]);

  const login = (user: AuthUser, token: string) => {
    const nextSession = { user, token };
    setAccessToken(token);
    window.localStorage.removeItem('homelink-auth-user');
    setSession(nextSession);
  };
  const logout = () => {
    void logoutApi().catch(() => undefined);
    setAccessToken(null);
    window.localStorage.removeItem('homelink-auth-user');
    setSession(null);
  };

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isLoading,
      isAuthenticated: Boolean(session?.user && session.token),
      login,
      logout,
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
