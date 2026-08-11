import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export function useLiveUpdates() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/live/events`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok || !response.body) return;
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          const frames = buffer.split('\n\n'); buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const event = frame.match(/^event: (.+)$/m)?.[1];
            const raw = frame.match(/^data: (.+)$/m)?.[1];
            if (!event || !raw || event === 'connected') continue;
            const data = JSON.parse(raw) as Record<string, unknown>;
            if (event === 'payment.updated') void queryClient.invalidateQueries({ queryKey: ['backend-state', 'payment-records'] });
            if (event === 'notification.created') window.dispatchEvent(new CustomEvent('homelink:live-notification', { detail: data }));
          }
        }
      } catch (error) { if (!controller.signal.aborted) console.warn('Live updates disconnected', error); }
    })();
    return () => controller.abort();
  }, [queryClient, token]);
}
