import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function userPreferenceKey(userId: string | undefined, name: string) {
  return `homelink-preference:${userId ?? 'guest'}:${name}`;
}

export function useUserPreference<T>(name: string, initial: T) {
  const { user } = useAuth();
  const key = userPreferenceKey(user?.id, name);
  const read = () => { try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : initial; } catch { return initial; } };
  const [value, setValue] = useState<T>(read);
  useEffect(() => setValue(read()), [key]);
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}
