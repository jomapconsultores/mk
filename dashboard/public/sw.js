// Service Worker — Marketing MAP PWA
const CACHE = 'mmap-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  // Solo cachear GET; pasar el resto directamente
  if (e.request.method !== 'GET') return;

  // No interceptar las API calls ni las rutas Next.js
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/')) return;

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request)),
  );
});
