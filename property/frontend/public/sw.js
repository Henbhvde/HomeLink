const CACHE = 'homelink-shell-v1';
const DB = 'homelink-offline-queue';
const STORE = 'requests';
const SHELL = ['/', '/index.html', '/offline.html', '/manifest.webmanifest', '/icon.svg'];
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx(mode, run) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const result = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function queueRequest(request) {
  const headers = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  const body = await request.clone().text();
  await tx('readwrite', (store) => store.add({ url: request.url, method: request.method, headers, body, createdAt: Date.now() }));
}

async function replayQueue() {
  const items = await tx('readonly', (store) => new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => resolve([]);
  }));
  for (const item of items) {
    try {
      const response = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body || undefined, credentials: 'include' });
      if (!response.ok) continue;
      await tx('readwrite', (store) => store.delete(item.id));
    } catch {
      break;
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'homelink-offline-queue') event.waitUntil(replayQueue());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'HOMELINK_REPLAY_QUEUE') event.waitUntil(replayQueue());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (MUTATING.has(request.method)) {
    event.respondWith(fetch(request.clone()).catch(async () => {
      await queueRequest(request);
      if ('sync' in self.registration) await self.registration.sync.register('homelink-offline-queue');
      return Response.json({ success: true, message: 'Queued offline.', data: { queued: true } }, { status: 202 });
    }));
    return;
  }
  event.respondWith(fetch(request).then((response) => {
    if (request.mode === 'navigate') caches.open(CACHE).then((cache) => cache.put('/index.html', response.clone()));
    return response;
  }).catch(async () => {
    if (request.mode === 'navigate') return (await caches.match('/index.html')) || caches.match('/offline.html');
    return (await caches.match(request)) || Response.error();
  }));
});
