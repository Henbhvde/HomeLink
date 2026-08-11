import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { userPreferenceKey } from '../hooks/useUserPreference';

export type ThemeMode = 'light' | 'dark';

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const storageKey = userPreferenceKey(user?.id, 'theme');
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = window.localStorage.getItem(storageKey);
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    setTheme(saved === 'dark' || saved === 'light' ? saved : 'light');
  }, [storageKey]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark'),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
