import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';
type BackendStateStatus = 'loading' | 'ready' | 'error';
type ApiResponse<T> = { success: boolean; data: T | null };
const domainEndpoints: Record<string, string> = {
  'manager-buildings': 'buildings', 'manager-residents': 'residents', 'meter-readings': 'meter-readings',
  'billing-invoices': 'invoices', 'billing-run': 'invoice-runs/current', 'payment-statements': 'bank-statements',
  'payment-records': 'payments', 'expense-records': 'expenses', 'maintenance-requests': 'maintenance-requests',
  'maintenance-announcements': 'maintenance-announcements', 'manager-settings': 'manager-settings',
  'accountant-period': 'accounting-periods/current', 'staff-work-orders': 'work-orders',
  'resident-portal-notices': 'resident/notices', 'resident-portal-tickets': 'resident/portal-tickets',
  'resident-service-tickets': 'resident/service-tickets', 'resident-community-notices': 'resident/community-notices',
};

export function useBackendState<T>(scope: string, seed: T): [T, Dispatch<SetStateAction<T>>, BackendStateStatus, () => void] {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const seedRef = useRef(seed);
  const endpoint = domainEndpoints[scope];
  if (!endpoint) throw new Error(`Unknown domain resource: ${scope}`);
  seedRef.current = seed;
  const queryKey = ['backend-state', scope, token] as const;
  const headers = (json = false) => ({ ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const readResponse = async (response: Response) => {
    const payload = await response.json().catch(() => null) as ApiResponse<T> | null;
    if (!response.ok || !payload?.success || payload.data === null) throw new Error('Backend state request failed.');
    return payload.data;
  };

  const query = useQuery({
    queryKey,
    enabled: Boolean(token),
    queryFn: async () => {
      const response = await fetch(`${apiBase}/${endpoint}`, { headers: headers() });
      if (response.status !== 404) return readResponse(response);
      return readResponse(await fetch(`${apiBase}/${endpoint}`, {
        method: 'PUT',
        headers: headers(true),
        body: JSON.stringify({ data: seedRef.current }),
      }));
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ next }: { next: T; previous: T }) => readResponse(await fetch(`${apiBase}/${endpoint}`, {
      method: 'PUT',
      headers: headers(true),
      body: JSON.stringify({ data: next }),
    })),
    onError: (_error, variables) => queryClient.setQueryData(queryKey, variables.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>((nextValue) => {
    const previous = queryClient.getQueryData<T>(queryKey) ?? seedRef.current;
    const next = typeof nextValue === 'function' ? (nextValue as (current: T) => T)(previous) : nextValue;
    queryClient.setQueryData(queryKey, next);
    mutation.mutate({ next, previous });
  }, [mutation, queryClient, queryKey]);

  const status: BackendStateStatus = query.isError || mutation.isError ? 'error' : query.isPending ? 'loading' : 'ready';
  return [query.data ?? seedRef.current, setPersistentValue, status, () => { void query.refetch(); }];
}
