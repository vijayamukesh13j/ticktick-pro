/* TickTick Pro Service Worker */
const CACHE_NAME = 'ticktick-pro-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './app-icon.svg',
];

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((err) => {
        console.warn('[SW] Pre-cache warning:', err);
      })
  );
});

// Activate Event - Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        return self.clients.claim();
      })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin Supabase / external API calls
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip POST, PUT, DELETE, etc.
  if (request.method !== 'GET') {
    return;
  }

  // For HTML navigations, use Stale-While-Revalidate with fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('./') || caches.match('./index.html');
        })
    );
    return;
  }

  // Cache-first for images, fonts, styles, and scripts
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting an image, could return fallback if needed
        });
    })
  );
});

// Background Timer & Alert Scheduler
let activePomoTimeout = null;

// Listen for message events (skipWaiting, background timer scheduling)
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'SCHEDULE_POMO_ALERT') {
    if (activePomoTimeout) {
      clearTimeout(activePomoTimeout);
      activePomoTimeout = null;
    }

    const targetTime = event.data.targetTimestamp;
    const now = Date.now();
    const delay = Math.max(0, targetTime - now);

    activePomoTimeout = setTimeout(() => {
      self.registration.showNotification(
        event.data.title || '🎉 Focus Session Finished!',
        {
          body:
            event.data.body ||
            'Great job! You completed your focus session. Time for a break.',
          icon: './icon-192.png',
          badge: './icon-192.png',
          tag: 'ticktick-pomo-complete',
          renotify: true,
          vibrate: [200, 100, 200, 100, 400],
          data: {
            url: './',
          },
        }
      );
      activePomoTimeout = null;
    }, delay);
  }

  if (event.data.type === 'CANCEL_POMO_ALERT') {
    if (activePomoTimeout) {
      clearTimeout(activePomoTimeout);
      activePomoTimeout = null;
    }
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('./');
      }
    })
  );
});
