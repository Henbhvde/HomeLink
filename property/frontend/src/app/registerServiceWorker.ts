export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      const replay = () => registration.active?.postMessage({ type: 'HOMELINK_REPLAY_QUEUE' });
      window.addEventListener('online', replay);
      replay();
    }).catch(() => undefined);
  });
}
