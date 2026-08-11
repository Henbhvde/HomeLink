import { useEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userPreferenceKey } from './useUserPreference';

export function useUrlQueryState<T extends string>(key: string, fallback: T, allowed?: readonly T[]) {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const raw = params.get(key);
  const storageKey = userPreferenceKey(user?.id, `filter:${pathname}:${key}`);
  const saved = window.localStorage.getItem(storageKey);
  const validSaved = saved !== null && (!allowed || allowed.includes(saved as T)) ? saved as T : fallback;
  const value = raw && (!allowed || allowed.includes(raw as T)) ? raw as T : validSaved;

  useEffect(() => {
    if (!raw && validSaved !== fallback) setParams((current) => { const updated = new URLSearchParams(current); updated.set(key, validSaved); return updated; }, { replace: true });
  }, [fallback, key, raw, setParams, validSaved]);

  const setValue = (next: T) => setParams((current) => {
    window.localStorage.setItem(storageKey, next);
    const updated = new URLSearchParams(current);
    if (next === fallback) updated.delete(key);
    else updated.set(key, next);
    return updated;
  }, { replace: true });

  return [value, setValue] as const;
}
